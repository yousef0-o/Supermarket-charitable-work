-- Step 10: Helper functions for user management (List, Edit, Delete)
-- Run this in your Supabase SQL Editor

-- 1. Function to list all users safely
create or replace function public.list_users()
returns table (
  id uuid,
  email varchar,
  name text,
  role text,
  created_at timestamp with time zone
)
language sql
security definer
set search_path = public, auth
as $$
  select
    u.id,
    u.email,
    coalesce(u.raw_user_meta_data->>'name', '')::text as name,
    coalesce(u.raw_user_meta_data->>'role', 'manager')::text as role,
    u.created_at
  from auth.users u
  where exists (
    select 1
    from auth.users caller
    where caller.id = auth.uid()
      and coalesce(caller.raw_user_meta_data->>'role', 'manager') = 'manager'
  )
  order by u.created_at desc;
$$;

-- 2. Function to delete a user safely
create or replace function public.delete_user(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  -- Check if caller is manager
  if not exists (
    select 1
    from auth.users
    where id = auth.uid()
      and coalesce(raw_user_meta_data->>'role', 'manager') = 'manager'
  ) then
    raise exception 'Unauthorized: caller must be a manager';
  end if;

  -- Prevent self-deletion
  if p_user_id = auth.uid() then
    raise exception 'Cannot delete your own account';
  end if;

  delete from auth.users where id = p_user_id;
end;
$$;

-- 3. Function to update a user's metadata safely
create or replace function public.update_user_meta(p_user_id uuid, p_name text, p_role text)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  -- Check if caller is manager
  if not exists (
    select 1
    from auth.users
    where id = auth.uid()
      and coalesce(raw_user_meta_data->>'role', 'manager') = 'manager'
  ) then
    raise exception 'Unauthorized: caller must be a manager';
  end if;

  update auth.users
  set raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('name', p_name, 'role', p_role)
  where id = p_user_id;
end;
$$;
