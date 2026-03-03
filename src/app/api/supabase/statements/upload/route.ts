import { supabase } from '@/lib/supabase';
import { NextResponse } from 'next/server';
import { parseCSV } from '@/lib/csvParser';

export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get('file') as File;
  const accountId = formData.get('accountId') as string;
  const month = parseInt(formData.get('month') as string);
  const year = parseInt(formData.get('year') as string);

  if (!file || !accountId || !month || !year) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const { data: existing } = await supabase
    .from('statements')
    .select('id')
    .eq('account_id', accountId)
    .eq('month', month)
    .eq('year', year)
    .single();

  if (existing) {
    await supabase
      .from('transactions')
      .delete()
      .eq('statement_id', existing.id);
  }

  const transactions = await parseCSV(file);

  const { data: statement, error: stmtError } = await supabase
    .from('statements')
    .upsert({
      account_id: accountId,
      month,
      year,
      file_name: file.name,
    }, {
      onConflict: 'account_id,month,year'
    })
    .select()
    .single();

  if (stmtError) {
    return NextResponse.json({ error: stmtError.message }, { status: 500 });
  }

  if (transactions.length > 0) {
    const { error: txError } = await supabase
      .from('transactions')
      .insert(
        transactions.map((t) => ({
          account_id: accountId,
          statement_id: statement.id,
          date: t.date.toISOString(),
          description: t.description,
          amount: t.amount,
          type: t.type,
        }))
      );

    if (txError) {
      return NextResponse.json({ error: txError.message }, { status: 500 });
    }
  }

  return NextResponse.json({ statement, transactionCount: transactions.length });
}
