import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { parseCSV } from '@/lib/csvParser';
import { parsePDF, type FaturaMeta } from '@/lib/pdfParser';
import { validateStatementUpload, ValidationError } from '@/lib/validation';
import { createClient } from '@supabase/supabase-js';
import { batchCategorize } from '@/lib/autoCategorize';
import { detectAndUpsertSubscriptions, normalizeDescription } from '@/lib/subscriptionDetector';
import { withApiLogging } from '@/lib/apiLogger';
import { applyFaturaToInvoice } from '@/lib/creditCard/applyFatura';
import { faturaDedupWindow } from '@/lib/creditCard/invoiceCycle';
import { parseInstallment } from '@/lib/creditCard/installment';
import { installmentGroupId } from '@/lib/creditCard/installmentGroup';

// Bank statements are small; this cap mostly guards against abusive uploads
// since the whole file is buffered in memory for parsing.
const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024;

// The original file name is user-controlled and interpolated into the storage
// path — strip anything that could escape the prefix (slashes, "..") and keep
// the path short.
function sanitizeFileName(name: string): string {
  const base = name.split(/[/\\]/).pop() ?? '';
  const safe = base.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/\.{2,}/g, '.');
  return (safe || 'statement').slice(-100);
}

export const POST = withApiLogging(async (request: Request) => {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const accountId = formData.get('accountId') as string;
    const month = parseInt(formData.get('month') as string, 10);
    const year = parseInt(formData.get('year') as string, 10);

    // Validate input
    validateStatementUpload({ file, accountId, month, year });

    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        { error: `File is too large. Maximum size is ${MAX_FILE_SIZE_BYTES / (1024 * 1024)} MB.` },
        { status: 413 }
      );
    }

    // Load the account — credit-card faturas need type + closingDay for cycle logic.
    const account = await prisma.account.findUnique({ where: { id: accountId } });
    if (!account) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }
    const isCreditCard = account.type === 'CREDIT_CARD';

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
        const filePath = `${accountId}/${year}-${month.toString().padStart(2, '0')}/${timestamp}_${sanitizeFileName(file.name)}`;

        // Convert File to ArrayBuffer then to Buffer for upload
        const fileBuffer = await file.arrayBuffer();

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('statements')
          .upload(filePath, fileBuffer, {
            // Derived from the validated extension — file.type is client-controlled.
            contentType: isCSV ? 'text/csv' : 'application/pdf',
            upsert: false,
          });

        if (uploadError) {
          console.error('Supabase storage upload error:', uploadError);
          // Continue without file URL if upload fails
        } else if (uploadData) {
          // Store the storage path (not a public URL — bucket is private).
          // Callers that need to view the file should call
          // GET /api/statements/[id]/signed-url to get a fresh short-lived URL.
          fileUrl = uploadData.path;
        }
      } catch (storageError) {
        console.error('Storage error:', storageError);
        // Continue without file URL if storage fails
      }
    }

    // NOTE: We do NOT delete existing transactions on re-upload.
    // Instead we use a merge strategy below: only insert parsed rows that do not
    // match an existing transaction by (date, amount, description). This preserves
    // any categoryId, notes, and isRecurring edits the user made on prior transactions.

    let transactions: { date: Date; description: string; amount: number; type: 'INCOME' | 'EXPENSE'; categoryId?: string | null }[] = [];
    let faturaMeta: FaturaMeta | null = null;
    let parseMessage: string | undefined;

    if (isCSV) {
      // Parse CSV files
      transactions = await parseCSV(file);
    } else if (isPDF) {
      // Parse PDF files via the AI/local parser. Credit-card accounts use the
      // dedicated fatura path which also returns invoice metadata.
      try {
        const result = await parsePDF(file, account.type);
        transactions = result.transactions;
        faturaMeta = result.faturaMeta;
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

    let uniqueTransactions: typeof transactions = [];
    let duplicateCount = 0;

    if (transactions.length > 0) {
      // Check for potential duplicates across all statements (not just this one).
      // Credit-card faturas cross the calendar-month boundary, so widen the window
      // to the billing cycle — otherwise re-uploads duplicate cross-boundary rows.
      // Widening is safe: dedup matches exact (date, amount, description).
      const { start: startDate, end: endDate } = isCreditCard
        ? faturaDedupWindow(month, year, account.closingDay)
        : { start: new Date(year, month - 1, 1), end: new Date(year, month, 0, 23, 59, 59) };

      // Include ALL transactions for this account+month — including any already linked
      // to this statement from a previous upload. This ensures re-uploading the same
      // statement skips already-imported rows instead of creating duplicates, and
      // preserves user edits (categoryId, notes, isRecurring) on existing transactions.
      const existingTransactions = await prisma.transaction.findMany({
        where: {
          accountId,
          date: {
            gte: startDate,
            lte: endDate,
          },
        },
        select: {
          date: true,
          amount: true,
          description: true,
        },
      });

      // Filter out duplicates. Two transactions are considered the same when they
      // share the same date and amount AND either their raw descriptions match or
      // their normalized descriptions match (catches minor bank-side description
      // variations like trailing card numbers, settle-date suffixes, etc.).
      uniqueTransactions = transactions.filter((newTx) => {
        const newNorm = normalizeDescription(newTx.description);
        return !existingTransactions.some(
          (existingTx) => {
            if (existingTx.date.getTime() !== newTx.date.getTime()) return false;
            if (Math.abs(existingTx.amount - newTx.amount) >= 0.01) return false;
            const rawMatch = existingTx.description.trim().toLowerCase() === newTx.description.trim().toLowerCase();
            if (rawMatch) return true;
            const existingNorm = normalizeDescription(existingTx.description);
            return existingNorm === newNorm && existingNorm.length > 2;
          }
        );
      });

      duplicateCount = transactions.length - uniqueTransactions.length;
      if (duplicateCount > 0) {
        parseMessage = parseMessage
          ? `${parseMessage} ${duplicateCount} duplicate transaction(s) were skipped.`
          : `${duplicateCount} duplicate transaction(s) were skipped.`;
      }
    }

    // Auto-categorize outside the transaction — it only reads rules.
    const categorizationResults = uniqueTransactions.length > 0
      ? await batchCategorize(
          uniqueTransactions.map(t => ({
            description: t.description,
            amount: t.amount,
          }))
        )
      : new Map<number, { categoryId: string | null }>();

    // Persist atomically: statement upsert, transaction insert and fatura
    // materialization either all land or none do — a partial failure must not
    // leave a statement without its transactions or invoice.
    const statement = await prisma.$transaction(async (tx) => {
      const stmt = await tx.statement.upsert({
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

      if (uniqueTransactions.length > 0) {
        // Apply categorization results (+ installment metadata for credit cards).
        const transactionsWithCategories = uniqueTransactions.map((t, index) => {
          const result = categorizationResults.get(index);
          const base = {
            accountId,
            statementId: stmt.id,
            date: t.date,
            description: t.description,
            amount: t.amount,
            type: t.type,
            categoryId: result?.categoryId || t.categoryId || null,
          };
          if (!isCreditCard) return base;
          const installment = parseInstallment(t.description);
          return {
            ...base,
            installmentNumber: installment?.number ?? null,
            installmentTotal: installment?.total ?? null,
            installmentGroupId: installment
              ? installmentGroupId(accountId, t.description, installment.total)
              : null,
          };
        });

        await tx.transaction.createMany({
          data: transactionsWithCategories,
        });
      }

      // Credit-card faturas: materialize the invoice, link its transactions, and
      // refresh the account's limit/closing/due snapshot from the extracted meta.
      // Runs even with zero transactions so a metadata-only fatura still updates
      // the limit. Idempotent on re-upload.
      if (isCreditCard) {
        await applyFaturaToInvoice(
          {
            accountId,
            statementId: stmt.id,
            referenceMonth: month,
            referenceYear: year,
            faturaMeta,
          },
          tx
        );
      }

      return stmt;
    }, { timeout: 15_000 });

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
    return NextResponse.json({ error: 'Failed to process statement' }, { status: 500 });
  }
});
