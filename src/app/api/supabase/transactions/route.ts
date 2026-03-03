import { supabase } from '@/lib/supabase';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const accountId = searchParams.get('accountId');
  const categoryId = searchParams.get('categoryId');
  const type = searchParams.get('type');
  const dateFrom = searchParams.get('dateFrom');
  const dateTo = searchParams.get('dateTo');
  const minAmount = searchParams.get('minAmount');
  const maxAmount = searchParams.get('maxAmount');
  const search = searchParams.get('search');
  const limit = searchParams.get('limit');

  let query = supabase
    .from('transactions')
    .select(`
      id,
      account_id,
      statement_id,
      category_id,
      type,
      amount,
      description,
      date,
      is_recurring,
      notes,
      created_at,
      updated_at,
      accounts ( name, color ),
      categories ( id, name, color )
    `)
    .order('date', { ascending: false });

  if (accountId) query = query.eq('account_id', accountId);
  if (categoryId) query = query.eq('category_id', categoryId);
  if (type) query = query.eq('type', type);
  if (dateFrom) query = query.gte('date', dateFrom);
  if (dateTo) query = query.lte('date', dateTo);
  if (minAmount) query = query.gte('amount', parseFloat(minAmount));
  if (maxAmount) query = query.lte('amount', parseFloat(maxAmount));
  if (search) query = query.ilike('description', `%${search}%`);
  if (limit) query = query.limit(parseInt(limit));

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data?.map(t => ({
    ...t,
    isRecurring: t.is_recurring,
    createdAt: t.created_at,
    updatedAt: t.updated_at,
    accountId: t.account_id,
    statementId: t.statement_id,
    categoryId: t.category_id,
    account: t.accounts,
    category: t.categories,
  })));
}

export async function PUT(request: Request) {
  const body = await request.json();
  
  const { data, error } = await supabase
    .from('transactions')
    .update({
      category_id: body.categoryId || null,
      notes: body.notes || null,
    })
    .eq('id', body.id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
