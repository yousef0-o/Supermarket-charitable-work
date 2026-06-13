-- Step 9: Add phone column to beneficiaries table
-- Run this in your Supabase SQL Editor

alter table public.beneficiaries
  add column if not exists phone text;
