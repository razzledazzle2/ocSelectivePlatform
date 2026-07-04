-- Admin-curated mock tests.
--
-- Until now every mock exam was generated randomly per student session
-- (mock_exam_sessions). This adds admin-AUTHORED mock tests: a fixed,
-- reviewable paper made of ordered sections (Reading -> break -> Mathematical
-- Reasoning -> break -> Thinking Skills -> break -> Writing) with hand-picked
-- questions. Existing session tables are untouched; a nullable
-- mock_exam_sessions.mock_test_id link is added so future student runs of a
-- curated mock can feed attempt statistics back to the admin pages.
--
-- Lifecycle mirrors questions: draft -> published -> archived. Students can
-- only ever read published mocks; staff (tutor/admin/super_admin) manage them.

-- 1. Mock test header.
create table if not exists public.mock_tests (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  exam_type text not null check (exam_type in ('OC', 'Selective')),
  year_level integer check (year_level is null or year_level between 1 and 12),
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  published_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. Ordered sections, each with its own timer and an optional break AFTER it.
--    section_key ties standard sections to the student runner's vocabulary;
--    'custom' allows ad-hoc sections without code changes.
create table if not exists public.mock_test_sections (
  id uuid primary key default gen_random_uuid(),
  mock_test_id uuid not null references public.mock_tests(id) on delete cascade,
  section_order integer not null,
  section_key text not null default 'custom' check (
    section_key in ('reading', 'mathematical_reasoning', 'thinking_skills', 'writing', 'custom')
  ),
  name text not null,
  subject_id uuid references public.subjects(id) on delete set null,
  time_limit_seconds integer not null check (time_limit_seconds > 0),
  break_after_seconds integer not null default 0 check (break_after_seconds >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 3. Hand-picked questions inside a section. A question may appear only once
--    per mock test. question_order has no unique constraint so reordering can
--    be written row-by-row without transient conflicts; the app keeps it dense.
create table if not exists public.mock_test_questions (
  id uuid primary key default gen_random_uuid(),
  mock_test_id uuid not null references public.mock_tests(id) on delete cascade,
  section_id uuid not null references public.mock_test_sections(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete cascade,
  question_order integer not null,
  marks integer not null default 1 check (marks > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (mock_test_id, question_id)
);

-- 4. Link student sessions to the curated mock they ran (null = randomised).
alter table public.mock_exam_sessions
  add column if not exists mock_test_id uuid references public.mock_tests(id) on delete set null;

create index if not exists idx_mock_tests_status on public.mock_tests(status);
create index if not exists idx_mock_tests_updated_at on public.mock_tests(updated_at desc);
create index if not exists idx_mock_test_sections_mock_test_id on public.mock_test_sections(mock_test_id);
create index if not exists idx_mock_test_questions_mock_test_id on public.mock_test_questions(mock_test_id);
create index if not exists idx_mock_test_questions_section_id on public.mock_test_questions(section_id);
create index if not exists idx_mock_test_questions_question_id on public.mock_test_questions(question_id);
create index if not exists idx_mock_exam_sessions_mock_test_id on public.mock_exam_sessions(mock_test_id);

drop trigger if exists mock_tests_set_updated_at on public.mock_tests;
create trigger mock_tests_set_updated_at
before update on public.mock_tests
for each row execute function public.set_updated_at();

drop trigger if exists mock_test_sections_set_updated_at on public.mock_test_sections;
create trigger mock_test_sections_set_updated_at
before update on public.mock_test_sections
for each row execute function public.set_updated_at();

drop trigger if exists mock_test_questions_set_updated_at on public.mock_test_questions;
create trigger mock_test_questions_set_updated_at
before update on public.mock_test_questions
for each row execute function public.set_updated_at();

alter table public.mock_tests enable row level security;
alter table public.mock_test_sections enable row level security;
alter table public.mock_test_questions enable row level security;

grant select, insert, update, delete on public.mock_tests to authenticated;
grant select, insert, update, delete on public.mock_test_sections to authenticated;
grant select, insert, update, delete on public.mock_test_questions to authenticated;

-- RLS: staff manage everything; students read published mocks only.
drop policy if exists "mock_tests_read_published_or_staff" on public.mock_tests;
create policy "mock_tests_read_published_or_staff"
on public.mock_tests
for select
to authenticated
using (
  status = 'published'
  or public.get_current_user_role() in ('tutor', 'admin', 'super_admin')
);

drop policy if exists "mock_tests_staff_manage" on public.mock_tests;
create policy "mock_tests_staff_manage"
on public.mock_tests
for all
to authenticated
using (public.get_current_user_role() in ('tutor', 'admin', 'super_admin'))
with check (public.get_current_user_role() in ('tutor', 'admin', 'super_admin'));

drop policy if exists "mock_test_sections_read_published_or_staff" on public.mock_test_sections;
create policy "mock_test_sections_read_published_or_staff"
on public.mock_test_sections
for select
to authenticated
using (
  public.get_current_user_role() in ('tutor', 'admin', 'super_admin')
  or exists (
    select 1
    from public.mock_tests tests
    where tests.id = mock_test_sections.mock_test_id
      and tests.status = 'published'
  )
);

drop policy if exists "mock_test_sections_staff_manage" on public.mock_test_sections;
create policy "mock_test_sections_staff_manage"
on public.mock_test_sections
for all
to authenticated
using (public.get_current_user_role() in ('tutor', 'admin', 'super_admin'))
with check (public.get_current_user_role() in ('tutor', 'admin', 'super_admin'));

drop policy if exists "mock_test_questions_read_published_or_staff" on public.mock_test_questions;
create policy "mock_test_questions_read_published_or_staff"
on public.mock_test_questions
for select
to authenticated
using (
  public.get_current_user_role() in ('tutor', 'admin', 'super_admin')
  or exists (
    select 1
    from public.mock_tests tests
    where tests.id = mock_test_questions.mock_test_id
      and tests.status = 'published'
  )
);

drop policy if exists "mock_test_questions_staff_manage" on public.mock_test_questions;
create policy "mock_test_questions_staff_manage"
on public.mock_test_questions
for all
to authenticated
using (public.get_current_user_role() in ('tutor', 'admin', 'super_admin'))
with check (public.get_current_user_role() in ('tutor', 'admin', 'super_admin'));
