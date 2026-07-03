-- Sectioned (randomised full) mock exams + cross-student mock comparison.
--
-- 1. New mock type 'randomised_full': a full exam split into ordered sections
--    (Reading -> 5 min break -> Mathematical Reasoning -> 10 min break ->
--    Thinking Skills -> 5 min break -> Writing), each with its own timer.
--    Existing single-section mock types are untouched.
--
-- 2. mock_exam_session_sections: one row per section of a session. Writing is a
--    free-response section (writing_response), submitted for marking or kept as
--    a draft ("finish later"); it never contributes to the auto-marked score.
--
-- 3. mock_exam_session_questions.section_id links questions to their section.
--
-- 4. get_mock_exam_comparison(): average accuracy and rank across students who
--    submitted the same kind of mock. Students can only read their own sessions
--    under RLS, so the aggregate is a security-definer function; the app applies
--    a minimum-participants threshold before showing any comparison.

-- 1. Allow the new mock type.
alter table public.mock_exam_sessions
  drop constraint if exists mock_exam_sessions_mock_type_check;

alter table public.mock_exam_sessions
  add constraint mock_exam_sessions_mock_type_check
  check (mock_type in ('mini', 'subject', 'full_selective', 'full_oc', 'randomised_full'));

-- 2. Sections.
create table if not exists public.mock_exam_session_sections (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.mock_exam_sessions(id) on delete cascade,
  section_order integer not null,
  section_key text not null check (
    section_key in ('reading', 'mathematical_reasoning', 'thinking_skills', 'writing')
  ),
  subject_id uuid references public.subjects(id) on delete set null,
  status text not null default 'pending' check (
    status in ('pending', 'in_progress', 'submitted', 'skipped')
  ),
  time_limit_seconds integer not null check (time_limit_seconds > 0),
  break_after_seconds integer not null default 0 check (break_after_seconds >= 0),
  started_at timestamptz,
  submitted_at timestamptz,
  writing_response text,
  writing_submitted_for_marking boolean not null default false,
  total_questions integer not null default 0,
  correct_count integer not null default 0,
  incorrect_count integer not null default 0,
  unanswered_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (session_id, section_order)
);

create trigger mock_exam_session_sections_set_updated_at
  before update on public.mock_exam_session_sections
  for each row execute function public.set_updated_at();

create index if not exists idx_mock_exam_session_sections_session_id
  on public.mock_exam_session_sections(session_id);

alter table public.mock_exam_session_sections enable row level security;

grant select, insert, update on public.mock_exam_session_sections to authenticated;

create policy mock_exam_session_sections_create_own
  on public.mock_exam_session_sections
  for insert
  with check (
    exists (
      select 1
      from public.mock_exam_sessions sessions
      where sessions.id = session_id
        and sessions.student_id = auth.uid()
    )
  );

create policy mock_exam_session_sections_read_own_or_staff
  on public.mock_exam_session_sections
  for select
  using (
    exists (
      select 1
      from public.mock_exam_sessions sessions
      where sessions.id = session_id
        and sessions.student_id = auth.uid()
    )
    or public.get_current_user_role() in ('tutor', 'admin', 'super_admin')
  );

create policy mock_exam_session_sections_update_own
  on public.mock_exam_session_sections
  for update
  using (
    exists (
      select 1
      from public.mock_exam_sessions sessions
      where sessions.id = session_id
        and sessions.student_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.mock_exam_sessions sessions
      where sessions.id = session_id
        and sessions.student_id = auth.uid()
    )
  );

-- 3. Link questions to sections (null for legacy single-section mocks).
alter table public.mock_exam_session_questions
  add column if not exists section_id uuid references public.mock_exam_session_sections(id) on delete set null;

create index if not exists idx_mock_exam_session_questions_section_id
  on public.mock_exam_session_questions(section_id);

-- 4. Cross-student comparison.
--
-- Cohort = submitted sessions with the same mock_type + exam_type (+ subject for
-- subject mocks). Each student is represented by their best accuracy, so retakes
-- do not skew the average. Rank is the calling session's accuracy against other
-- students' best runs. Returns a single row; participant_count includes the caller.
create or replace function public.get_mock_exam_comparison(p_session_id uuid)
returns table (
  participant_count bigint,
  average_accuracy numeric,
  student_rank bigint
)
language sql
security definer
set search_path = public
stable
as $$
  with own_session as (
    select sessions.*
    from public.mock_exam_sessions sessions
    where sessions.id = p_session_id
      and sessions.status = 'submitted'
      and sessions.accuracy is not null
      and (
        sessions.student_id = auth.uid()
        or public.get_current_user_role() in ('tutor', 'admin', 'super_admin')
      )
  ),
  cohort_best as (
    select cohort.student_id, max(cohort.accuracy) as best_accuracy
    from public.mock_exam_sessions cohort
    join own_session
      on cohort.mock_type = own_session.mock_type
      and cohort.exam_type = own_session.exam_type
      and cohort.subject_id is not distinct from own_session.subject_id
    where cohort.status = 'submitted'
      and cohort.accuracy is not null
    group by cohort.student_id
  )
  select
    (select count(*) from cohort_best) as participant_count,
    (select round(avg(best_accuracy), 1) from cohort_best) as average_accuracy,
    (
      select 1 + count(*)
      from cohort_best
      join own_session on true
      where cohort_best.student_id <> own_session.student_id
        and cohort_best.best_accuracy > own_session.accuracy
    ) as student_rank
  from own_session
$$;

grant execute on function public.get_mock_exam_comparison(uuid) to authenticated;
