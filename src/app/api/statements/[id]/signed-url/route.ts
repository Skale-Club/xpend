import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { createClient } from '@supabase/supabase-js';

// Signed URL TTL: 7 days (604800 seconds).
// The bucket is private — this endpoint is the only way to get a download link.
const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24 * 7;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const statement = await prisma.statement.findUnique({
      where: { id },
      select: { fileUrl: true, fileName: true },
    });

    if (!statement) {
      return NextResponse.json({ error: 'Statement not found' }, { status: 404 });
    }

    if (!statement.fileUrl) {
      return NextResponse.json({ error: 'No file stored for this statement' }, { status: 404 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        { error: 'Storage not configured' },
        { status: 503 }
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data, error } = await supabase.storage
      .from('statements')
      .createSignedUrl(statement.fileUrl, SIGNED_URL_TTL_SECONDS);

    if (error || !data?.signedUrl) {
      console.error('Failed to create signed URL:', error);
      return NextResponse.json({ error: 'Failed to generate download link' }, { status: 500 });
    }

    return NextResponse.json({
      signedUrl: data.signedUrl,
      fileName: statement.fileName,
      expiresIn: SIGNED_URL_TTL_SECONDS,
    });
  } catch (error) {
    console.error('Signed URL error:', error);
    return NextResponse.json({ error: 'Failed to generate download link' }, { status: 500 });
  }
}
