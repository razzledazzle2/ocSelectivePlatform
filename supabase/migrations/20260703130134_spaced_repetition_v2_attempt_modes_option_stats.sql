-- Spaced repetition v2, revision attempt mode, and option response distribution.
--
-- 1. Add the 'almost_mastered' stage to student_mistake_questions.status.
--    New ladder (driven by correct_streak):
--      wrong            -> needs_review,    due in 1 day
--      1 correct retry  -> learning,        due in 7 days
--      2 correct        -> improving,       due in 30 days
--      3 correct        -> almost_mastered, due in 180 days
--      4 correct        -> mastered
--    Existing rows keep their status; already-mastered questions stay mastered.
--
-- 2. Allow question_attempts.mode = 'revision' so revision retries are
--    distinguishable from ordinary practice in analytics.
--
-- 3. get_question_option_stats(): aggregated option response distribution for a
--    question. Students can only read their OWN attempt rows under RLS, so the
--    percentages must come from a security-definer aggregate. Guards:
--      - question must be published;
--      - the caller must have attempted the question themselves (or be staff),
--        so distributions can never be fetched before answering.

-- 1. Spaced repetition status vocabulary.
alter table public.student_mistake_questions
  drop constraint if exists student_mistake_questions_status_check;

alter table public.student_mistake_questions
  add constraint student_mistake_questions_status_check
  check (status in ('needs_review', 'learning', 'improving', 'almost_mastered', 'mastered'));

-- 2. Revision attempts.
alter table public.question_attempts
  drop constraint if exists question_attempts_mode_check;

alter table public.question_attempts
  add constraint question_attempts_mode_check
  check (mode in ('practice', 'revision', 'mock'));

-- 3. Option response distribution.
create or replace function public.get_question_option_stats(p_question_id uuid)
returns table (option_label text, attempt_count bigint)
language sql
security definer
set search_path = public
stable
as $$
  select
    attempts.selected_option_label as option_label,
    count(*) as attempt_count
  from public.question_attempts attempts
  join public.questions on questions.id = attempts.question_id
  where attempts.question_id = p_question_id
    and questions.status = 'published'
    and (
      public.get_current_user_role() in ('tutor', 'admin', 'super_admin')
      or exists (
        select 1
        from public.question_attempts own
        where own.question_id = p_question_id
          and own.student_id = auth.uid()
      )
    )
  group by attempts.selected_option_label
$$;

grant execute on function public.get_question_option_stats(uuid) to authenticated;
