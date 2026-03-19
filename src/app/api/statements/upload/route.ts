import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { parseCSV } from '@/lib/csvParser';
import { parsePDF } from '@/lib/pdfParser';
import { validateStatementUpload, ValidationError } from '@/lib/validation';
import { createClient } from '@supabase/supabase-js';
import { batchCategorize } from '@/lib/autoCategorize';
import { detectAndUpsertSubscriptions } from '@/lib/subscriptionDetector';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const accountId = formData.get('accountId') as string;
    const month = parseInt(formData.get('month') as string);
    const year = parseInt(formData.get('year') as string);

    // Validate input
    validateStatementUpload({ file, accountId, month, year });

    // Check file type
    const fileName = file.name.toLowerCase();
    const isCSV = fileName.endsWith('.csv');
    const isPDF = fileName.endsWith('.pdf');

    if (!isCSV && !isPDF) {
      return NextResponse.json({
        error: 'Unsupported file type. Please upload a CSV or PDF file.'
      }, { status: 400 });
    }

    // Upload file to Supabase Storage
    let fileUrl: string | null = null;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (supabaseUrl && supabaseServiceKey) {
      try {
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // Create a unique file path: statements/{accountId}/{year}-{month}/{timestamp}_{filename}
        const timestamp = Date.now();
        const filePath = `${accountId}/${year}-${month.toString().padStart(2, '0')}/${timestamp}_${file.name}`;

        // Convert File to ArrayBuffer then to Buffer for upload
        const fileBuffer = await file.arrayBuffer();

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('statements')
          .upload(filePath, fileBuffer, {
            contentType: file.type || (isCSV ? 'text/csv' : 'application/pdf'),
            upsert: false,
          });

        if (uploadError) {
          console.error('Supabase storage upload error:', uploadError);
          // Continue without file URL if upload fails
        } else if (uploadData) {
          // Get public URL
          const { data: urlData } = supabase.storage
            .from('statements')
            .getPublicUrl(filePath);

          fileUrl = urlData.publicUrl;
        }
      } catch (storageError) {
        console.error('Storage error:', storageError);
        // Continue without file URL if storage fails
      }
    }

    const existingStatement = await prisma.statement.findUnique({
      where: {
        accountId_month_year: { accountId, month, year },
      },
    });

    if (existingStatement) {
      await prisma.transaction.deleteMany({
        where: { statementId: existingStatement.id },
      });
    }

    let transactions: { date: Date; description: string; amount: number; type: 'INCOME' | 'EXPENSE'; categoryId?: string | null }[] = [];
    let parseMessage: string | undefined;

    if (isCSV) {
      // Parse CSV files
      transactions = await parseCSV(file);
    } else if (isPDF) {
      // Parse PDF files using Google Gemini API
      try {
        transactions = await parsePDF(file);
        if (transactions.length === 0) {
          parseMessage = 'PDF processed, but no transactions were found. Please verify the file is a valid bank statement.';
        }
      } catch (pdfError) {
        console.error('PDF parsing error:', pdfError);
        // Store the statement even if parsing fails
        parseMessage = pdfError instanceof Error
          ? `Error processing PDF: ${pdfError.message}`
          : 'Error processing PDF. Please verify the file is valid.';
      }
    }

    const statement = await prisma.statement.upsert({
      where: {
        accountId_month_year: { accountId, month, year },
      },
      create: {
        accountId,
        month,
        year,
        fileName: file.name,
        fileUrl: fileUrl,
      },
      update: {
        fileName: file.name,
        fileUrl: fileUrl,
      },
    });

    if (transactions.length > 0) {
      // Check for potential duplicates across all statements (not just this one)
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0, 23, 59, 59);

      const existingTransactions = await prisma.transaction.findMany({
        where: {
          accountId,
          date: {
            gte: startDate,
            lte: endDate,
          },
          statementId: { not: statement.id }, // Exclude current statement's transactions
        },
        select: {
          date: true,
          amount: true,
          description: true,
        },
      });

      // Filter out duplicates (same date, amount, and description)
      const uniqueTransactions = transactions.filter((newTx) => {
        return !existingTransactions.some(
          (existingTx) =>
            existingTx.date.getTime() === newTx.date.getTime() &&
            Math.abs(existingTx.amount - newTx.amount) < 0.01 && // Handle floating point comparison
            existingTx.description.trim().toLowerCase() === newTx.description.trim().toLowerCase()
        );
      });

      const duplicateCount = transactions.length - uniqueTransactions.length;

      if (uniqueTransactions.length > 0) {
        // Auto-categorize transactions using rules and AI
        const categorizationResults = await batchCategorize(
          uniqueTransactions.map(t => ({
            description: t.description,
            amount: t.amount,
          }))
        );

        // Apply categorization results
        const transactionsWithCategories = uniqueTransactions.map((t, index) => {
          const result = categorizationResults.get(index);
          return {
            accountId,
            statementId: statement.id,
            date: t.date,
            description: t.description,
            amount: t.amount,
            type: t.type,
            categoryId: result?.categoryId || t.categoryId || null,
          };
        });

        await prisma.transaction.createMany({
          data: transactionsWithCategories,
        });
      }

      if (duplicateCount > 0) {
        parseMessage = parseMessage
          ? `${parseMessage} ${duplicateCount} duplicate transaction(s) were skipped.`
          : `${duplicateCount} duplicate transaction(s) were skipped.`;
      }
    }

    // Get actual count of created transactions
    const createdCount = await prisma.transaction.count({
      where: { statementId: statement.id },
    });

    // Trigger subscription detection in background (non-blocking)
    detectAndUpsertSubscriptions(accountId).catch((err) =>
      console.error('Background subscription detection failed:', err)
    );

    return NextResponse.json({
      statement,
      transactionCount: createdCount,
      totalParsed: transactions.length,
      message: parseMessage,
    });
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error('Upload error:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Failed to process statement'
    }, { status: 500 });
  }
}
