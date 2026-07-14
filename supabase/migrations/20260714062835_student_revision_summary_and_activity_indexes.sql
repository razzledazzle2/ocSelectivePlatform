-- Revision summary aggregate + supporting indexes.
--
-- The Revision page previously derived its overdue/due-today/mastered counts by
-- fetching getStudentMistakeQuestions(...).limit(200) and filtering in JS — for
-- any student with more than 200 tracked mistakes this silently undercounts,
-- the same bug already fixed for the dashboard's due-count in
-- `student_dashboard_aggregates` but not backported here. This function groups
-- and counts in Postgres instead, following the exact same
-- SECURITY DEFINER + owner/staff guard pattern as `get_student_revision_due_areas`.
--
-- Bucketing (Australia/Sydney calendar day, matching src/lib/dashboard/activity.ts):
--   overdue         = not mastered, next_review_at has passed, and was before today
--   due_today       = not mastered, next_review_at has passed, and was today
--   upcoming        = not mastered, next_review_at is within the next 7 days (not yet due)
--   almost_mastered = status = 'almost_mastered' (independent of due timing)
--   mastered        = status = 'mastered'
--   total           = all tracked mistakes for the student

create or replace function public.get_student_revision_summary(p_student_id uuid)
returns table (
  overdue_count bigint,
  due_today_count bigint,
  upcoming_count bigint,
  almost_mastered_count bigint,
  mastered_count bigint,
  total_count bigint
)
language sql
security definer
set search_path = public
stable
as $$
  select
    count(*) filter (
      where m.status <> 'mastered'
        and m.next_review_at is not null
        and m.next_review_at <= now()
        and m.next_review_at < (date_trunc('day', now() at time zone 'Australia/Sydney') at time zone 'Australia/Sydney')
    ) as overdue_count,
    count(*) filter (
      where m.status <> 'mastered'
        and m.next_review_at is not null
        and m.next_review_at <= now()
        and m.next_review_at >= (date_trunc('day', now() at time zone 'Australia/Sydney') at time zone 'Australia/Sydney')
    ) as due_today_count,
    count(*) filter (
      where m.status <> 'mastered'
        and m.next_review_at is not null
        and m.next_review_at > now()
        and m.next_review_at <= now() + interval '7 days'
    ) as upcoming_count,
    count(*) filter (where m.status = 'almost_mastered') as almost_mastered_count,
    count(*) filter (where m.status = 'mastered') as mastered_count,
    count(*) as total_count
  from public.student_mistake_questions m
  where m.student_id = p_student_id
    and (
      p_student_id = auth.uid()
      or public.get_current_user_role() in ('tutor', 'admin', 'super_admin')
    )
$$;

comment on function public.get_student_revision_summary(uuid) is
  'Accurate overdue/due-today/upcoming/almost-mastered/mastered/total counts for one student''s revision queue, computed in Postgres so the count is never capped by a row-fetch limit. Owner or staff only.';

grant execute on function public.get_student_revision_summary(uuid) to authenticated;

-- Composite indexes to support the summary above and the new paginated queue/history reads.
create index if not exists idx_student_mistake_questions_student_status_review
  on public.student_mistake_questions(student_id, status, next_review_at);

create index if not exists idx_practice_sessions_student_created
  on public.practice_sessions(student_id, created_at desc);
