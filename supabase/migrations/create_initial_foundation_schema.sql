create extension if not exists "pgcrypto";

create table if not exists public.organisations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null default 'tutoring_centre',
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text,
  role text not null default 'student',
  year_level integer,
  target_exam text,
  school text,
  avatar_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_role_check
    check (role in ('student', 'admin', 'tutor', 'parent', 'external_customer', 'super_admin')),
  constraint profiles_year_level_check
    check (year_level is null or year_level between 3 and 12),
  constraint profiles_email_format_check
    check (email is null or position('@' in email) > 1)
);

create table if not exists public.organisation_users (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null,
  created_at timestamptz not null default now(),
  constraint organisation_users_role_check
    check (role in ('student', 'admin', 'tutor', 'parent', 'external_customer', 'super_admin')),
  constraint organisation_users_unique_membership
    unique (organisation_id, user_id)
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.get_current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select role from public.profiles where id = auth.uid()),
    'student'
  );
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (
    id,
    full_name,
    email,
    role,
    year_level,
    target_exam
  )
  values (
    new.id,
    new.raw_user_meta_data ->> 'full_name',
    new.email,
    coalesce(new.raw_user_meta_data ->> 'role', 'student'),
    nullif(new.raw_user_meta_data ->> 'year_level', '')::integer,
    new.raw_user_meta_data ->> 'target_exam'
  )
  on conflict (id) do update
  set
    full_name = excluded.full_name,
    email = excluded.email,
    target_exam = excluded.target_exam;

  return new;
end;
$$;

create or replace function public.enforce_profile_update_scope()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  current_role text := public.get_current_user_role();
begin
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

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

drop trigger if exists profiles_enforce_scope on public.profiles;
create trigger profiles_enforce_scope
before update on public.profiles
for each row
execute function public.enforce_profile_update_scope();

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.organisations enable row level security;
alter table public.organisation_users enable row level security;

grant usage on schema public to anon, authenticated;
grant select on public.organisations to authenticated;
grant select on public.organisation_users to authenticated;
grant select on public.profiles to authenticated;
grant update (full_name, year_level, target_exam, school, avatar_url) on public.profiles to authenticated;
grant update on public.profiles to service_role;

drop policy if exists "profiles_select_own_or_privileged" on public.profiles;
create policy "profiles_select_own_or_privileged"
on public.profiles
for select
to authenticated
using (
  auth.uid() = id
  or public.get_current_user_role() in ('admin', 'super_admin')
  or (
    public.get_current_user_role() = 'tutor'
    and role = 'student'
  )
);

drop policy if exists "students_update_own_profile" on public.profiles;
create policy "students_update_own_profile"
on public.profiles
for update
to authenticated
using (
  auth.uid() = id
  and public.get_current_user_role() = 'student'
)
with check (
  auth.uid() = id
  and public.get_current_user_role() = 'student'
);

drop policy if exists "admins_update_all_profiles" on public.profiles;
create policy "admins_update_all_profiles"
on public.profiles
for update
to authenticated
using (public.get_current_user_role() in ('admin', 'super_admin'))
with check (public.get_current_user_role() in ('admin', 'super_admin'));

drop policy if exists "admins_manage_organisations" on public.organisations;
create policy "admins_manage_organisations"
on public.organisations
for all
to authenticated
using (public.get_current_user_role() in ('admin', 'super_admin'))
with check (public.get_current_user_role() in ('admin', 'super_admin'));

drop policy if exists "members_read_organisations" on public.organisations;
create policy "members_read_organisations"
on public.organisations
for select
to authenticated
using (
  public.get_current_user_role() in ('admin', 'super_admin')
  or exists (
    select 1
    from public.organisation_users organisation_user
    where organisation_user.organisation_id = organisations.id
      and organisation_user.user_id = auth.uid()
  )
);

drop policy if exists "admins_manage_organisation_users" on public.organisation_users;
create policy "admins_manage_organisation_users"
on public.organisation_users
for all
to authenticated
using (public.get_current_user_role() in ('admin', 'super_admin'))
with check (public.get_current_user_role() in ('admin', 'super_admin'));

drop policy if exists "users_read_own_organisation_memberships" on public.organisation_users;
create policy "users_read_own_organisation_memberships"
on public.organisation_users
for select
to authenticated
using (
  public.get_current_user_role() in ('admin', 'super_admin')
  or user_id = auth.uid()
);
