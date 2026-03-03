import { supabase } from '@/lib/supabase';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const dateFrom = searchParams.get('dateFrom');
  const dateTo = searchParams.get('dateTo');
  const accountIds = searchParams.get('accountIds')?.split(',').filter(Boolean);

  let txQuery = supabase
    .from('transactions')
    .select(`
      id,
      account_id,
      type,
      amount,
      description,
      date,
      category_id,
      accounts ( id, name, color, initial_balance ),
      categories ( id, name, color )
    `)
    .order('date', { ascending: false });

  if (dateFrom) txQuery = txQuery.gte('date', dateFrom);
  if (dateTo) txQuery = txQuery.lte('date', dateTo);
  if (accountIds && accountIds.length > 0) {
    txQuery = txQuery.in('account_id', accountIds);
  }

  const { data: transactions, error: txError } = await txQuery;

  if (txError) {
    return NextResponse.json({ error: txError.message }, { status: 500 });
  }

  const totalIncome = transactions
    ?.filter((t) => t.type === 'INCOME')
    .reduce((sum, t) => sum + Number(t.amount), 0) || 0;

  const totalExpenses = transactions
    ?.filter((t) => t.type === 'EXPENSE')
    .reduce((sum, t) => sum + Number(t.amount), 0) || 0;

  const { data: accounts } = await supabase
    .from('accounts')
    .select('id, initial_balance')
    .eq('is_active', true);

  const balances: Record<string, number> = {};
  
  for (const account of accounts || []) {
    const { data: accountTx } = await supabase
      .from('transactions')
      .select('type, amount')
      .eq('account_id', account.id);

    const income = accountTx
      ?.filter((t) => t.type === 'INCOME')
      .reduce((sum, t) => sum + Number(t.amount), 0) || 0;
    const expenses = accountTx
      ?.filter((t) => t.type === 'EXPENSE')
      .reduce((sum, t) => sum + Number(t.amount), 0) || 0;

    balances[account.id] = Number(account.initial_balance) + income - expenses;
  }

  const monthlyData = getMonthlyData(transactions || []);
  const categoryData = getCategoryData(transactions || []);
  const balanceTrend = getBalanceTrend(accounts || [], transactions || []);

  return NextResponse.json({
    totalIncome,
    totalExpenses,
    totalBalance: totalIncome - totalExpenses,
    transactionCount: transactions?.length || 0,
    monthlyData,
    categoryData,
    balanceTrend,
    balances,
    transactions: transactions?.slice(0, 50).map(t => ({
      ...t,
      accountId: t.account_id,
      categoryId: t.category_id,
      account: t.accounts,
      category: t.categories,
    })),
  });
}

function getMonthlyData(transactions: { date: string; type: string; amount: number }[]) {
  const monthlyMap = new Map<string, { income: number; expenses: number }>();

  for (const t of transactions) {
    const date = new Date(t.date);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

    if (!monthlyMap.has(key)) {
      monthlyMap.set(key, { income: 0, expenses: 0 });
    }

    const data = monthlyMap.get(key)!;
    if (t.type === 'INCOME') {
      data.income += Number(t.amount);
    } else if (t.type === 'EXPENSE') {
      data.expenses += Number(t.amount);
    }
  }

  return Array.from(monthlyMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, data]) => {
      const [year, month] = key.split('-');
      const monthName = new Date(parseInt(year), parseInt(month) - 1).toLocaleString('default', {
        month: 'short',
      });
      return {
        month: monthName,
        year: parseInt(year),
        income: data.income,
        expenses: data.expenses,
        balance: data.income - data.expenses,
      };
    });
}

function getCategoryData(transactions: { type: string; amount: number; categories: { id: string; name: string; color: string } | { id: string; name: string; color: string }[] | null }[]) {
  const categoryMap = new Map<string, { total: number; count: number; color: string; name: string }>();
  const expenses = transactions.filter((t) => t.type === 'EXPENSE');
  const totalExpenses = expenses.reduce((sum, t) => sum + Number(t.amount), 0);

  for (const t of expenses) {
    const cat = Array.isArray(t.categories) ? t.categories[0] : t.categories;
    const key = cat?.id || 'uncategorized';
    const name = cat?.name || 'Uncategorized';
    const color = cat?.color || '#6B7280';

    if (!categoryMap.has(key)) {
      categoryMap.set(key, { total: 0, count: 0, color, name });
    }

    const data = categoryMap.get(key)!;
    data.total += Number(t.amount);
    data.count += 1;
  }

  return Array.from(categoryMap.entries())
    .map(([id, data]) => ({
      categoryId: id,
      categoryName: data.name,
      color: data.color,
      total: data.total,
      percentage: totalExpenses > 0 ? (data.total / totalExpenses) * 100 : 0,
      count: data.count,
    }))
    .sort((a, b) => b.total - a.total);
}

function getBalanceTrend(
  accounts: { id: string; initial_balance: number }[],
  transactions: { account_id: string; date: string; type: string; amount: number }[]
) {
  const monthlyBalances = new Map<string, number>();
  const sortedTransactions = [...transactions].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  const initialTotal = accounts.reduce((sum, a) => sum + Number(a.initial_balance), 0);
  let runningBalance = initialTotal;

  for (const t of sortedTransactions) {
    const date = new Date(t.date);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

    if (t.type === 'INCOME') {
      runningBalance += Number(t.amount);
    } else if (t.type === 'EXPENSE') {
      runningBalance -= Number(t.amount);
    }

    monthlyBalances.set(key, runningBalance);
  }

  return Array.from(monthlyBalances.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, balance]) => {
      const [year, month] = key.split('-');
      const monthName = new Date(parseInt(year), parseInt(month) - 1).toLocaleString('default', {
        month: 'short',
      });
      return {
        month: `${monthName} ${year}`,
        balance,
      };
    });
}
