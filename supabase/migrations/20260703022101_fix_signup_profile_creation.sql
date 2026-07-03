-- Fix signup ("Database error saving new user") and admin promotion.
--
-- Two problems addressed:
--
-- 1. enforce_profile_update_scope() raised "You are not allowed to update this
--    profile" whenever auth.uid() is NULL. auth.uid() is NULL in trusted,
--    non-end-user contexts: the Supabase SQL editor (postgres), service_role,
--    and SECURITY DEFINER triggers such as handle_new_user(). That broke:
--      - `update public.profiles set role = 'admin' where email = ...` run from
--        the SQL editor (the documented way to promote an admin), and
--      - the ON CONFLICT DO UPDATE branch inside handle_new_user().
--    Fix: when auth.uid() is NULL there is no end user to police, so allow the
--    update. Client access is still gated by RLS + column-level grants (the
--    `authenticated` role has no UPDATE grant on `role`), so this does not open
--    up client-side role escalation.
--
-- 2. handle_new_user() aborted the entire auth signup if the profile insert
--    raised for any reason (e.g. an out-of-range year_level from metadata).
--    A trigger on auth.users that raises blocks ALL signups. Fix: sanitise the
--    optional metadata, and wrap the upsert so a failure logs a warning instead
--    of failing the signup. Combined with the backfill below, a missing profile
--    is always recoverable.

-- 1. Let system / service / SQL-editor contexts update profiles.
create or replace function public.enforce_profile_update_scope()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  current_role text := public.get_current_user_role();
begin
  -- No end-user JWT (postgres / service_role / SECURITY DEFINER trigger): allow.
  if auth.uid() is null then
    return new;
  end if;

  if current_role in ('admin', 'super_admin') then
    return new;
  end if;

  if auth.uid() = old.id and current_role = 'student' then
    if new.id is distinct from old.id
      or new.email is distinct from old.email
      or new.role is distinct from old.role
      or new.is_active is distinct from old.is_active
      or new.created_at is distinct from old.created_at
      or new.updated_at is distinct from old.updated_at then
      raise exception 'Students can only update their own editable profile fields.';
    end if;

    return new;
  end if;

  raise exception 'You are not allowed to update this profile.';
end;
$$;

-- 2. Signup-safe new-user handler. Role is always 'student' (never from client
--    metadata). Optional fields are sanitised, and a failed insert can never
--    block the auth signup.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  parsed_year integer;
begin
  -- Only accept a valid in-range year level; anything else becomes null.
  begin
    parsed_year := nullif(meta ->> 'year_level', '')::integer;
    if parsed_year is not null and (parsed_year < 3 or parsed_year > 12) then
      parsed_year := null;
    end if;
  exception when others then
    parsed_year := null;
  end;

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
      coalesce(meta ->> 'full_name', meta ->> 'name'),
      'student',
      parsed_year,
      nullif(meta ->> 'target_exam', ''),
      now(),
      now()
    )
    on conflict (id) do update
    set
      email = excluded.email,
      full_name = coalesce(public.profiles.full_name, excluded.full_name),
      updated_at = now();
    -- `role` is never overwritten on conflict: existing admin/tutor/super_admin
    -- users are never demoted back to student.
  exception when others then
    -- Never block signup because of profile creation; the backfill below and
    -- the app's missing-profile fallback recover the row.
    raise warning 'handle_new_user: could not upsert profile for %: %', new.id, sqlerrm;
  end;

  return new;
end;
$$;

-- 3. Ensure the trigger exists.
drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user();

-- 4. Backfill any auth users that still have no profile row.
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
