-- Student dashboard aggregates — push counting/grouping into Postgres.
--
-- The student dashboard, progress and practice pages previously downloaded a
-- student's ENTIRE question_attempts history (with three relation joins) and
-- aggregated it in application memory. These functions do the counting and
-- grouping in the database and return only compact grouped rows, so no route
-- ever streams thousands of raw attempt rows for a summary figure.
--
-- Statistical semantics are unchanged — they mirror the existing pure helpers:
--   * a "day" is the Australia/Sydney local date of attempted_at
--     (src/lib/dashboard/activity.ts ACTIVITY_TIMEZONE + Intl 'en-CA' key)
--   * a revision retry is an attempt with session_id IS NULL; a practice
--     attempt carries a session_id
--   * weak/strong areas group by subject/topic/question-type NAME, skipping
--     attempts with no subject (mirrors computeWeakStrong's areaKey guard)
--   * a revision item is "due" when it is not mastered and its next_review_at
--     has passed (mirrors getStudentDashboardData's dueMistakes filter)
--
-- Security: SECURITY DEFINER (so the fixed search_path holds), but every
-- function re-enforces the SAME ownership boundary as the table RLS policies —
-- a caller may only aggregate their OWN attempts unless they are staff. Passing
-- another student's id returns zero rows, exactly as RLS would.

-- 1) Per-day activity ---------------------------------------------------------
-- Powers the activity calendar, current/longest streak, active-days-this-month,
-- questions-this-week AND overall accuracy (sum of correct / sum of total).
-- Bounded by the number of distinct active days (≈365/year), not attempts.
create or replace function public.get_student_daily_activity(p_student_id uuid)
returns table (
  activity_day date,
  practice_count bigint,
  revision_count bigint,
  total_count bigint,
  correct_count bigint
)
language sql
security definer
set search_path = public
stable
as $$
  select
    (qa.attempted_at at time zone 'Australia/Sydney')::date as activity_day,
    count(*) filter (where qa.session_id is not null) as practice_count,
    count(*) filter (where qa.session_id is null) as revision_count,
    count(*) as total_count,
    count(*) filter (where qa.is_correct) as correct_count
  from public.question_attempts qa
  where qa.student_id = p_student_id
    and (
      p_student_id = auth.uid()
      or public.get_current_user_role() in ('tutor', 'admin', 'super_admin')
    )
  group by 1
$$;

comment on function public.get_student_daily_activity(uuid) is
  'Per-Australia/Sydney-day attempt counts (practice/revision/total/correct) for one student. Owner or staff only.';

-- 2) Weak/strong area stats ---------------------------------------------------
-- Groups a student's attempts by subject/topic/question-type name. Attempts
-- with no subject are dropped (inner join subjects), matching the app rule that
-- an area must have a subject. Topic/type may be null and group as one bucket,
-- matching the app's `?? ''` key. Correctness gate (min attempts) is applied by
-- the caller against the returned counts.
create or replace function public.get_student_area_stats(p_student_id uuid)
returns table (
  subject_name text,
  topic_name text,
  question_type_name text,
  attempts bigint,
  correct bigint
)
language sql
security definer
set search_path = public
stable
as $$
  select
    s.name as subject_name,
    t.name as topic_name,
    qt.name as question_type_name,
    count(*) as attempts,
    count(*) filter (where qa.is_correct) as correct
  from public.question_attempts qa
  join public.subjects s on s.id = qa.subject_id
  left join public.topics t on t.id = qa.topic_id
  left join public.question_types qt on qt.id = qa.question_type_id
  where qa.student_id = p_student_id
    and (
      p_student_id = auth.uid()
      or public.get_current_user_role() in ('tutor', 'admin', 'super_admin')
    )
  group by s.name, t.name, qt.name
$$;

comment on function public.get_student_area_stats(uuid) is
  'Per subject/topic/question-type attempt + correct counts for one student, for weak/strong analysis. Owner or staff only.';

-- 3) Revision due-by-area -----------------------------------------------------
-- Due = not mastered AND next_review_at has passed. Grouped by subject/topic so
-- the dashboard can show the total due count and the top areas WITHOUT the old
-- limit(200) that silently undercounted heavy users, and without joining the
-- question text/options the preview never used.
create or replace function public.get_student_revision_due_areas(p_student_id uuid)
returns table (
  subject_name text,
  topic_name text,
  due_count bigint
)
language sql
security definer
set search_path = public
stable
as $$
  select
    s.name as subject_name,
    t.name as topic_name,
    count(*) as due_count
  from public.student_mistake_questions m
  left join public.subjects s on s.id = m.subject_id
  left join public.topics t on t.id = m.topic_id
  where m.student_id = p_student_id
    and (
      p_student_id = auth.uid()
      or public.get_current_user_role() in ('tutor', 'admin', 'super_admin')
    )
    and m.status <> 'mastered'
    and m.next_review_at is not null
    and m.next_review_at <= now()
  group by s.name, t.name
$$;

comment on function public.get_student_revision_due_areas(uuid) is
  'Count of due (not-mastered, past next_review_at) revision items per subject/topic for one student. Owner or staff only.';

grant execute on function public.get_student_daily_activity(uuid) to authenticated;
grant execute on function public.get_student_area_stats(uuid) to authenticated;
grant execute on function public.get_student_revision_due_areas(uuid) to authenticated;
