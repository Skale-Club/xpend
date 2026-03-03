import { supabase } from '@/lib/supabase';
import { NextResponse } from 'next/server';

export async function GET() {
  const { data, error } = await supabase
    .from('accounts')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data.map(a => ({
    id: a.id,
    name: a.name,
    type: a.type,
    bank: a.bank,
    color: a.color,
    icon: a.icon,
    initialBalance: a.initial_balance,
    isActive: a.is_active,
    createdAt: a.created_at,
    updatedAt: a.updated_at,
  })));
}

export async function POST(request: Request) {
  const body = await request.json();
  
  const { data, error } = await supabase
    .from('accounts')
    .insert({
      name: body.name,
      type: body.type,
      bank: body.bank || null,
      color: body.color || '#3B82F6',
      initial_balance: body.initialBalance || 0,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    id: data.id,
    name: data.name,
    type: data.type,
    bank: data.bank,
    color: data.color,
    icon: data.icon,
    initialBalance: data.initial_balance,
    isActive: data.is_active,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  });
}
