-- Fix: profile row was never created on signup because handle_new_user()
-- inserted into columns (year_level, target_exam) that do not exist on the
-- remote public.profiles table. The foundation migration that defines those
-- columns (create_initial_foundation_schema.sql) was never applied to this
-- project (its filename has no timestamp, so `supabase db push` skips it), so
-- the live table only has id, email, full_name, role, created_at, updated_at.
--
-- Insert 42703 ("column year_level does not exist") was being swallowed by the
-- previous exception handler, so signup succeeded but no profile appeared.
--
-- This migration redefines the handler to insert ONLY columns that exist.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
begin
  insert into public.profiles (
    id,
    email,
    full_name,
    role,
    created_at,
    updated_at
  )
  values (
    new.id,
    new.email,
    coalesce(meta ->> 'full_name', meta ->> 'name'),
    'student',
    now(),
    now()
  )
  on conflict (id) do update
  set
    email = excluded.email,
    full_name = coalesce(public.profiles.full_name, excluded.full_name),
    updated_at = now();
  -- `role` is never overwritten on conflict: an existing admin/tutor/super_admin
  -- is never demoted back to student.

  return new;
end;
$$;

-- Ensure the trigger points at the function.
drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user();

-- Backfill: create profiles for existing auth users that still have none. This
-- now succeeds because the column list matches the real table.
insert into public.profiles (
  id,
  email,
  full_name,
  role,
  created_at,
  updated_at
)
select
  users.id,
  users.email,
  coalesce(
    users.raw_user_meta_data ->> 'full_name',
    users.raw_user_meta_data ->> 'name'
  ),
  'student',
  now(),
  now()
from auth.users users
left join public.profiles profiles on profiles.id = users.id
where profiles.id is null;
