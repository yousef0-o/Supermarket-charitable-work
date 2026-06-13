-- Charity Aid Distribution Management System schema
-- Run this script in the Supabase SQL editor.

create extension if not exists "uuid-ossp";

create table if not exists public.beneficiaries (
  id uuid primary key default uuid_generate_v4(),
  full_name text not null,
  identifier text not null unique,
  family_size integer not null default 1 check (family_size >= 1),
  joined_at timestamp with time zone not null default now()
);

create table if not exists public.aid_transactions (
  id uuid primary key default uuid_generate_v4(),
  beneficiary_id uuid not null references public.beneficiaries(id) on delete cascade,
  received_at timestamp with time zone not null default now(),
  received_month date generated always as (
    date_trunc('month', received_at at time zone 'UTC')::date
  ) stored,
  admin_id uuid not null references auth.users(id)
);

create index if not exists beneficiaries_full_name_idx
  on public.beneficiaries using gin (to_tsvector('simple', full_name));

create index if not exists aid_transactions_beneficiary_id_idx
  on public.aid_transactions (beneficiary_id);

create index if not exists aid_transactions_received_at_idx
  on public.aid_transactions (received_at desc);

create unique index if not exists aid_transactions_one_per_beneficiary_month_idx
  on public.aid_transactions (beneficiary_id, received_month);

alter table public.beneficiaries enable row level security;
alter table public.aid_transactions enable row level security;

create policy "Authenticated users can read beneficiaries"
  on public.beneficiaries
  for select
  to authenticated
  using (true);

create policy "Authenticated users can create beneficiaries"
  on public.beneficiaries
  for insert
  to authenticated
  with check (true);

create policy "Authenticated users can update beneficiaries"
  on public.beneficiaries
  for update
  to authenticated
  using (true)
  with check (true);

create policy "Authenticated users can read aid transactions"
  on public.aid_transactions
  for select
  to authenticated
  using (true);

create policy "Authenticated users can create own aid transactions"
  on public.aid_transactions
  for insert
  to authenticated
  with check (admin_id = auth.uid());
