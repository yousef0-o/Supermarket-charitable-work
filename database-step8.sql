-- Step 8: Distribution Cycles & Dashboard Aggregation Migration
-- Run this in the Supabase SQL Editor AFTER the original database.sql

-- ==========================================================
-- 1. Distribution Cycles Table
-- ==========================================================
create table if not exists public.distribution_cycles (
  id uuid primary key default uuid_generate_v4(),
  started_at timestamp with time zone not null default now(),
  is_active boolean not null default true
);

alter table public.distribution_cycles enable row level security;

create policy "Authenticated users can read distribution cycles"
  on public.distribution_cycles for select to authenticated using (true);

create policy "Authenticated users can insert distribution cycles"
  on public.distribution_cycles for insert to authenticated with check (true);

create policy "Authenticated users can update distribution cycles"
  on public.distribution_cycles for update to authenticated using (true) with check (true);

-- ==========================================================
-- 2. Seed the initial active cycle
-- ==========================================================
insert into public.distribution_cycles (id, started_at, is_active)
values ('00000000-0000-0000-0000-000000000001', now(), true)
on conflict (id) do nothing;

-- ==========================================================
-- 3. Add cycle_id column to aid_transactions
-- ==========================================================
alter table public.aid_transactions
  add column if not exists cycle_id uuid references public.distribution_cycles(id) default '00000000-0000-0000-0000-000000000001';

-- Backfill existing rows
update public.aid_transactions
  set cycle_id = '00000000-0000-0000-0000-000000000001'
  where cycle_id is null;

-- Make it non-nullable after backfill
alter table public.aid_transactions
  alter column cycle_id set not null;

-- ==========================================================
-- 4. Replace unique constraint: was (beneficiary_id, received_month) -> now (beneficiary_id, cycle_id)
-- ==========================================================
drop index if exists public.aid_transactions_one_per_beneficiary_month_idx;

create unique index if not exists aid_transactions_one_per_beneficiary_cycle_idx
  on public.aid_transactions (beneficiary_id, cycle_id);

-- ==========================================================
-- 5. Add delete policy for beneficiaries (needed for manage page)
-- ==========================================================
create policy "Authenticated users can delete beneficiaries"
  on public.beneficiaries for delete to authenticated using (true);

-- ==========================================================
-- 6. RPC: get_dashboard_stats — server-side aggregation
-- ==========================================================
create or replace function public.get_dashboard_stats(p_cycle_id uuid)
returns json
language plpgsql
security definer
as $$
declare
  v_total_beneficiaries bigint;
  v_total_distributions bigint;
  v_cycle_distributions bigint;
  v_cycle_distinct_beneficiaries bigint;
  v_remaining bigint;
  v_chart_data json;
begin
  -- Total beneficiaries
  select count(*) into v_total_beneficiaries from public.beneficiaries;

  -- Total all-time distributions
  select count(*) into v_total_distributions from public.aid_transactions;

  -- Distributions in the active cycle
  select count(*) into v_cycle_distributions
    from public.aid_transactions
    where cycle_id = p_cycle_id;

  -- Distinct beneficiaries who received in active cycle
  select count(distinct beneficiary_id) into v_cycle_distinct_beneficiaries
    from public.aid_transactions
    where cycle_id = p_cycle_id;

  -- Remaining unreceived
  v_remaining := v_total_beneficiaries - v_cycle_distinct_beneficiaries;

  -- Monthly chart data for last 6 months
  select coalesce(json_agg(row_to_json(m)), '[]'::json)
  into v_chart_data
  from (
    select
      to_char(month_start, 'YYYY-MM') as month_key,
      extract(month from month_start)::int as month_index,
      extract(year from month_start)::int as year,
      count(t.id)::int as count
    from generate_series(
      date_trunc('month', now() - interval '5 months'),
      date_trunc('month', now()),
      '1 month'
    ) as month_start
    left join public.aid_transactions t
      on date_trunc('month', t.received_at) = month_start
    group by month_start
    order by month_start asc
  ) m;

  return json_build_object(
    'totalBeneficiaries', v_total_beneficiaries,
    'totalDistributions', v_total_distributions,
    'cycleDistributions', v_cycle_distributions,
    'remaining', v_remaining,
    'chartData', v_chart_data
  );
end;
$$;

-- ==========================================================
-- 7. RPC: reset_distribution_cycle — atomic cycle resetting
-- ==========================================================
create or replace function public.reset_distribution_cycle()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- 1. Deactivate all active distribution cycles
  update public.distribution_cycles
    set is_active = false
    where is_active = true;

  -- 2. Create a new active distribution cycle
  insert into public.distribution_cycles (is_active)
    values (true);
end;
$$;
