-- Schema do Trocado para Supabase (PostgreSQL + RLS)
-- Execute este script no SQL Editor do seu projeto Supabase.

create extension if not exists pgcrypto;

-- 1. Perfis de usuário
create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null default '',
  display_name text not null default '',
  theme text not null default 'dark' check (theme in ('light', 'dark', 'system')),
  created_at timestamptz not null default now()
);

-- 2. Categorias
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  color text not null default '#10B981',
  icon text not null default 'tag',
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_categories_user_id
  on public.categories (user_id, is_default desc, created_at asc, name asc);

create unique index if not exists idx_categories_user_name_ci
  on public.categories (user_id, lower(trim(name)));

-- 3. Despesas
create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  amount_cents integer not null check (amount_cents > 0 and amount_cents <= 100000000),
  merchant text not null,
  description text,
  category_id uuid not null references public.categories(id),
  subcategory text,
  payment_method text not null check (payment_method in ('pix', 'credito', 'debito', 'dinheiro', 'outro')),
  expense_date date not null,
  source text not null default 'manual' check (source in ('foto', 'texto', 'voz', 'manual')),
  ai_confidence integer check (ai_confidence is null or (ai_confidence >= 0 and ai_confidence <= 100)),
  receipt_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_expenses_user_date
  on public.expenses (user_id, expense_date desc, created_at desc, id desc);

create index if not exists idx_expenses_user_category
  on public.expenses (user_id, category_id);

-- 4. Orçamentos mensais por categoria
create table if not exists public.budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category_id uuid not null references public.categories(id) on delete cascade,
  monthly_limit_cents integer not null check (monthly_limit_cents > 0 and monthly_limit_cents <= 100000000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, category_id)
);

-- 5. Controle de uso diário de IA por usuário
create table if not exists public.ai_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  calls integer not null default 0,
  primary key (user_id, day)
);

-- 6. Row Level Security (RLS)
alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.expenses enable row level security;
alter table public.budgets enable row level security;
alter table public.ai_usage enable row level security;

drop policy if exists "profiles_own_all" on public.profiles;
create policy "profiles_own_all" on public.profiles
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "categories_own_all" on public.categories;
create policy "categories_own_all" on public.categories
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "expenses_own_all" on public.expenses;
create policy "expenses_own_all" on public.expenses
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "budgets_own_all" on public.budgets;
create policy "budgets_own_all" on public.budgets
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "ai_usage_own_all" on public.ai_usage;
create policy "ai_usage_own_all" on public.ai_usage
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 7. RPC atômico para incrementar uso diário da IA
create or replace function public.increment_ai_usage(p_day date)
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_calls integer;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  insert into public.ai_usage (user_id, day, calls)
  values (v_user_id, p_day, 1)
  on conflict (user_id, day)
  do update set calls = public.ai_usage.calls + 1
  returning calls into v_calls;

  return v_calls;
end;
$$;
