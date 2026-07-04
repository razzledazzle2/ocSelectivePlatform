-- Admin question statistics + tag maintenance tools.
--
-- 1. get_admin_question_stats(p_question_ids uuid[] default null)
--    Per-question attempt aggregates for the admin question bank, computed in
--    Postgres so the app never pulls raw attempt rows:
--      total / correct attempts, total time, last attempted date, and the full
--      option response distribution (all attempts) as jsonb, e.g. {"A":3,"B":12}.
--    Staff-only (tutor/admin/super_admin) — returns no rows for other roles.
--    With p_question_ids = null it returns a row for every question that has at
--    least one attempt, which powers whole-bank sorting by accuracy / wrong %.
--
-- 2. admin_rename_tag(p_old_tag, p_new_tag)
--    Renames (or merges, when the new tag already exists on a question) a tag
--    across questions.tags in one statement, deduplicating each array. Returns
--    the number of questions touched. Staff-only.

create or replace function public.get_admin_question_stats(p_question_ids uuid[] default null)
returns table (
  question_id uuid,
  total_attempts bigint,
  correct_attempts bigint,
  total_time_seconds bigint,
  last_attempted_at timestamptz,
  option_counts jsonb
)
language sql
security definer
set search_path = public
stable
as $$
  with base as (
    select
      attempts.question_id,
      attempts.selected_option_label,
      attempts.is_correct,
      attempts.time_taken_seconds,
      attempts.attempted_at
    from public.question_attempts attempts
    where public.get_current_user_role() in ('tutor', 'admin', 'super_admin')
      and (p_question_ids is null or attempts.question_id = any(p_question_ids))
  ),
  per_option as (
    select base.question_id, base.selected_option_label, count(*) as option_count
    from base
    group by base.question_id, base.selected_option_label
  ),
  distributions as (
    select
      per_option.question_id,
      jsonb_object_agg(per_option.selected_option_label, per_option.option_count) as option_counts
    from per_option
    group by per_option.question_id
  )
  select
    base.question_id,
    count(*) as total_attempts,
    count(*) filter (where base.is_correct) as correct_attempts,
    coalesce(sum(base.time_taken_seconds), 0)::bigint as total_time_seconds,
    max(base.attempted_at) as last_attempted_at,
    distributions.option_counts
  from base
  join distributions on distributions.question_id = base.question_id
  group by base.question_id, distributions.option_counts
$$;

grant execute on function public.get_admin_question_stats(uuid[]) to authenticated;

create or replace function public.admin_rename_tag(p_old_tag text, p_new_tag text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  affected integer;
begin
  if public.get_current_user_role() not in ('tutor', 'admin', 'super_admin') then
    raise exception 'Only staff can rename tags.';
  end if;

  if coalesce(trim(p_old_tag), '') = '' or coalesce(trim(p_new_tag), '') = '' then
    raise exception 'Both the old and new tag are required.';
  end if;

  update public.questions
  set tags = (
    select coalesce(array_agg(distinct tag order by tag), '{}')
    from unnest(array_replace(tags, p_old_tag, trim(p_new_tag))) as tag
  )
  where p_old_tag = any(tags);

  get diagnostics affected = row_count;
  return affected;
end;
$$;

grant execute on function public.admin_rename_tag(text, text) to authenticated;
