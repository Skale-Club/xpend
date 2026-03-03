-- Run this SQL in your Supabase SQL Editor

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Accounts table
create table public.accounts (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  type text not null check (type in ('CHECKING', 'SAVINGS', 'CREDIT_CARD', 'DEBIT_CARD', 'CASH', 'OTHER')),
  bank text,
  color text default '#3B82F6',
  icon text,
  initial_balance numeric default 0,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Categories table
create table public.categories (
  id uuid primary key default uuid_generate_v4(),
  name text unique not null,
  color text default '#6B7280',
  icon text,
  parent_id uuid references public.categories(id)
);

-- Statements table
create table public.statements (
  id uuid primary key default uuid_generate_v4(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  month integer not null check (month >= 1 and month <= 12),
  year integer not null,
  file_name text not null,
  file_url text,
  uploaded_at timestamptz default now(),
  unique(account_id, month, year)
);

-- Transactions table
create table public.transactions (
  id uuid primary key default uuid_generate_v4(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  statement_id uuid references public.statements(id) on delete set null,
  category_id uuid references public.categories(id) on delete set null,
  type text not null default 'EXPENSE' check (type in ('INCOME', 'EXPENSE', 'TRANSFER')),
  amount numeric not null,
  description text not null,
  date timestamptz not null,
  is_recurring boolean default false,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Indexes for performance
create index idx_transactions_account_date on public.transactions(account_id, date);
create index idx_transactions_category on public.transactions(category_id);
create index idx_transactions_date on public.transactions(date);
create index idx_statements_account_year on public.statements(account_id, year);

-- Updated at trigger function
create or replace function handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Apply updated_at triggers
create trigger handle_accounts_updated_at
  before update on public.accounts
  for each row execute function handle_updated_at();

create trigger handle_transactions_updated_at
  before update on public.transactions
  for each row execute function handle_updated_at();

-- Row Level Security (RLS) - enable if you want multi-tenant
-- alter table public.accounts enable row level security;
-- alter table public.categories enable row level security;
-- alter table public.statements enable row level security;
-- alter table public.transactions enable row level security;

-- For development, create policies that allow all (remove in production)
create policy "Allow all for development" on public.accounts for all using (true) with check (true);
create policy "Allow all for development" on public.categories for all using (true) with check (true);
create policy "Allow all for development" on public.statements for all using (true) with check (true);
create policy "Allow all for development" on public.transactions for all using (true) with check (true);

-- Insert default categories
insert into public.categories (name, color, icon) values
  ('Groceries', '#10B981', 'ShoppingCart'),
  ('Dining Out', '#F59E0B', 'Utensils'),
  ('Transportation', '#3B82F6', 'Car'),
  ('Utilities', '#8B5CF6', 'Zap'),
  ('Entertainment', '#EC4899', 'Film'),
  ('Shopping', '#06B6D4', 'ShoppingBag'),
  ('Healthcare', '#EF4444', 'Heart'),
  ('Education', '#6366F1', 'GraduationCap'),
  ('Travel', '#14B8A6', 'Plane'),
  ('Housing', '#84CC16', 'Home'),
  ('Insurance', '#F97316', 'Shield'),
  ('Subscriptions', '#A855F7', 'RefreshCw'),
  ('Salary', '#22C55E', 'Briefcase'),
  ('Investments', '#0EA5E9', 'TrendingUp'),
  ('Other Income', '#4ADE80', 'Plus'),
  ('Other Expenses', '#6B7280', 'MoreHorizontal');
