import { supabase } from '@/lib/supabase';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const accountId = searchParams.get('accountId');
  const year = searchParams.get('year');

  let query = supabase
    .from('statements')
    .select(`
      id,
      month,
      year,
      file_name,
      uploaded_at,
      accounts ( name, type )
    `)
    .order('year', { ascending: false })
    .order('month', { ascending: false });

  if (accountId) {
    query = query.eq('account_id', accountId);
  }
  if (year) {
    query = query.eq('year', parseInt(year));
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
