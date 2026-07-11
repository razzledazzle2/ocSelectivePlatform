-- Persist a student's active learning program (OC vs Selective) on their profile.
--
-- Until this migration is pushed the app resolves the active program from a
-- server-readable cookie (see src/lib/student-program/program.ts). Once pushed,
-- the profile column becomes the authoritative store and the cookie is only a
-- fallback / write-through. The resolver degrades gracefully if the column is
-- absent, so pushing this is safe and non-breaking either way.

alter table public.profiles
  add column if not exists active_program text;

alter table public.profiles
  drop constraint if exists profiles_active_program_check;

alter table public.profiles
  add constraint profiles_active_program_check
    check (active_program is null or active_program in ('OC', 'Selective'));

comment on column public.profiles.active_program is
  'Student-selected exam program (OC | Selective). Null means "not chosen yet"; the app falls back to a cookie then to OC.';
