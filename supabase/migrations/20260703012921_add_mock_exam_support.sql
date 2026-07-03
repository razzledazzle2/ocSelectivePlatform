-- Phase 6: Mock exams.
--
-- Dedicated tables model exam-style timed sessions because they need behaviour the
-- practice tables cannot express cleanly: deferred (post-submission) feedback, flagging,
-- unanswered questions, a fixed question order, and mock-specific exam types.
--
-- Answered mock questions are ALSO written into the existing question_attempts table
-- (mode = 'mock') so mock activity flows into the current dashboard analytics, streaks,
-- weak-area insights and mistake tracking. That only requires relaxing the mode check;
-- unanswered questions are never inserted there (selected_option_label is NOT NULL).

-- 1. Allow mock-mode question attempts alongside practice.
alter table public.question_attempts
  drop constraint if exists question_attempts_mode_check;

alter table public.question_attempts
  add constraint question_attempts_mode_check
  check (mode in ('practice', 'mock'));

-- 2. Mock exam session header.
create table if not exists public.mock_exam_sessions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  mock_type text not null,
  exam_type text not null,
  subject_id uuid references public.subjects(id) on delete set null,
  status text not null default 'in_progress',
  time_limit_seconds integer not null,
  started_at timestamptz not null default now(),
  submitted_at timestamptz,
  total_questions integer not null default 0,
  correct_count integer not null default 0,
  incorrect_count integer not null default 0,
  unanswered_count integer not null default 0,
  accuracy numeric,
  total_time_seconds integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint mock_exam_sessions_mock_type_check
    check (mock_type in ('mini', 'subject', 'full_selective', 'full_oc')),
  constraint mock_exam_sessions_exam_type_check
    check (exam_type in ('OC', 'Selective')),
  constraint mock_exam_sessions_status_check
    check (status in ('in_progress', 'submitted', 'expired')),
  constraint mock_exam_sessions_time_limit_check
    check (time_limit_seconds > 0),
  constraint mock_exam_sessions_counts_check
    check (
      total_questions >= 0
      and correct_count >= 0
      and incorrect_count >= 0
      and unanswered_count >= 0
    )
);

-- 3. Per-question rows for a mock exam session (answer state saved as the student progresses).
create table if not exists public.mock_exam_session_questions (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.mock_exam_sessions(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete cascade,
  question_order integer not null,
  selected_option_label text,
  is_flagged boolean not null default false,
  answered_at timestamptz,
  time_spent_seconds integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (session_id, question_id),
  unique (session_id, question_order),
  constraint mock_exam_session_questions_selected_option_label_check
    check (selected_option_label is null or selected_option_label in ('A', 'B', 'C', 'D')),
  constraint mock_exam_session_questions_time_spent_check
    check (time_spent_seconds is null or time_spent_seconds >= 0)
);

create index if not exists idx_mock_exam_sessions_student_id
  on public.mock_exam_sessions(student_id);
create index if not exists idx_mock_exam_sessions_status
  on public.mock_exam_sessions(status);
create index if not exists idx_mock_exam_sessions_created_at
  on public.mock_exam_sessions(created_at desc);
create index if not exists idx_mock_exam_session_questions_session_id
  on public.mock_exam_session_questions(session_id);
create index if not exists idx_mock_exam_session_questions_question_id
  on public.mock_exam_session_questions(question_id);

drop trigger if exists mock_exam_sessions_set_updated_at on public.mock_exam_sessions;
create trigger mock_exam_sessions_set_updated_at
before update on public.mock_exam_sessions
for each row
execute function public.set_updated_at();

drop trigger if exists mock_exam_session_questions_set_updated_at on public.mock_exam_session_questions;
create trigger mock_exam_session_questions_set_updated_at
before update on public.mock_exam_session_questions
for each row
execute function public.set_updated_at();

alter table public.mock_exam_sessions enable row level security;
alter table public.mock_exam_session_questions enable row level security;

grant select, insert, update on public.mock_exam_sessions to authenticated;
grant select, insert, update on public.mock_exam_session_questions to authenticated;

-- RLS: students may only create/read/update their own sessions.
-- Staff (tutor/admin/super_admin) may read results, consistent with existing policies.
drop policy if exists "mock_exam_sessions_students_create_own" on public.mock_exam_sessions;
create policy "mock_exam_sessions_students_create_own"
on public.mock_exam_sessions
for insert
to authenticated
with check (
  student_id = auth.uid()
  and public.get_current_user_role() in ('student', 'parent', 'external_customer', 'tutor', 'admin', 'super_admin')
);

drop policy if exists "mock_exam_sessions_read_own_or_staff" on public.mock_exam_sessions;
create policy "mock_exam_sessions_read_own_or_staff"
on public.mock_exam_sessions
for select
to authenticated
using (
  student_id = auth.uid()
  or public.get_current_user_role() in ('tutor', 'admin', 'super_admin')
);

drop policy if exists "mock_exam_sessions_update_own_or_staff" on public.mock_exam_sessions;
create policy "mock_exam_sessions_update_own_or_staff"
on public.mock_exam_sessions
for update
to authenticated
using (
  student_id = auth.uid()
  or public.get_current_user_role() in ('admin', 'super_admin')
)
with check (
  student_id = auth.uid()
  or public.get_current_user_role() in ('admin', 'super_admin')
);

-- Session-question rows inherit ownership from the parent session.
drop policy if exists "mock_exam_session_questions_create_own" on public.mock_exam_session_questions;
create policy "mock_exam_session_questions_create_own"
on public.mock_exam_session_questions
for insert
to authenticated
with check (
  exists (
    select 1
    from public.mock_exam_sessions session
    where session.id = mock_exam_session_questions.session_id
      and session.student_id = auth.uid()
  )
);

drop policy if exists "mock_exam_session_questions_read_own_or_staff" on public.mock_exam_session_questions;
create policy "mock_exam_session_questions_read_own_or_staff"
on public.mock_exam_session_questions
for select
to authenticated
using (
  exists (
    select 1
    from public.mock_exam_sessions session
    where session.id = mock_exam_session_questions.session_id
      and (
        session.student_id = auth.uid()
        or public.get_current_user_role() in ('tutor', 'admin', 'super_admin')
      )
  )
);

drop policy if exists "mock_exam_session_questions_update_own" on public.mock_exam_session_questions;
create policy "mock_exam_session_questions_update_own"
on public.mock_exam_session_questions
for update
to authenticated
using (
  exists (
    select 1
    from public.mock_exam_sessions session
    where session.id = mock_exam_session_questions.session_id
      and session.student_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.mock_exam_sessions session
    where session.id = mock_exam_session_questions.session_id
      and session.student_id = auth.uid()
  )
);
