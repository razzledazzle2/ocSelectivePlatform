-- Ensure every new auth.users row gets a matching public.profiles row.
--
-- Background: the initial foundation schema shipped a handle_new_user() trigger,
-- but it defaulted `role` from client-supplied `raw_user_meta_data->>'role'`,
-- which allowed role escalation at signup, and the trigger may not have been
-- active on all environments. This migration replaces the function with a
-- hardened version (role is ALWAYS 'student' on insert, never from client
-- metadata), re-creates the trigger, and backfills any auth users that are
-- currently missing a profile row.
--
-- To promote a user to admin (run from the Supabase SQL editor / service role):
--
--   update public.profiles
--   set role = 'admin'
--   where email = 'admin@example.com';
--
-- Existing admin/tutor/super_admin roles are preserved: the trigger never
-- overwrites `role` on conflict, and the backfill only inserts missing rows.

-- 1. Make sure the role check constraint allows all six application roles.
--    (Idempotent: safe to re-assert even if it already matches.)
alter table public.profiles
  drop constraint if exists profiles_role_check;

alter table public.profiles
  add constraint profiles_role_check
  check (role in ('student', 'parent', 'external_customer', 'tutor', 'admin', 'super_admin'));

-- 2. Hardened new-user handler. Runs as SECURITY DEFINER so it can insert past
--    RLS. Role is hardcoded to 'student' — client metadata cannot set it.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (
    id,
    email,
    full_name,
    role,
    year_level,
    target_exam,
    created_at,
    updated_at
  )
  values (
    new.id,
    new.email,
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name'
    ),
    'student',
    nullif(new.raw_user_meta_data ->> 'year_level', '')::integer,
    nullif(new.raw_user_meta_data ->> 'target_exam', ''),
    now(),
    now()
  )
  on conflict (id) do update
  set
    email = excluded.email,
    full_name = coalesce(public.profiles.full_name, excluded.full_name),
    updated_at = now();
  -- NOTE: `role` is intentionally NOT updated on conflict, so an existing
  -- admin/tutor/super_admin is never demoted back to student.

  return new;
end;
$$;

-- 3. (Re)create the trigger on auth.users.
drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user();

-- 4. Backfill: create profiles for existing auth users that have none.
--    New backfilled users default to 'student'; existing roles are untouched
--    because this only inserts rows that do not yet exist.
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
