-- Bulk permanent-delete RPC for the admin question bank.
--
-- The app already supports a single-question permanent delete
-- (hardDeleteQuestion in src/lib/questions/mutations.ts): it refuses unless the
-- question is archived AND has no question_attempts, student_mistake_questions,
-- mock_exam_session_questions or mock_test_questions rows, so a purge can never
-- destroy student history or analytics. This migration adds the same guarantee
-- for a bulk selection, in one round trip, without the check-then-delete race a
-- naive "SELECT eligibility, then DELETE" from the app would have.
--
-- 1. classify_hard_delete_candidates(uuid[])
--    Read-only, stable. Partitions a requested id list into existing/missing,
--    archived/invalid-state, and eligible/blocked (with reasons), for the
--    bulk-delete confirmation dialog's server-authoritative preview. Never
--    mutates anything, so it is safe to call repeatedly while the admin reviews
--    the dialog.
--
-- 2. hard_delete_questions(uuid[])
--    Deletes the eligible subset in ONE statement whose WHERE clause
--    re-evaluates "archived AND no history in any of the four tables" as part
--    of the same query snapshot as the DELETE itself — eligibility is checked
--    at the instant of deletion, not against a stale read from an earlier
--    statement, closing the check-then-delete race a separate
--    classify-then-delete round trip would have. It then finds assets that
--    were only referenced by the deleted questions (via question_assets or
--    question_options.asset_id) and are now referenced nowhere at all
--    (checking question_assets, question_options AND stimulus_assets), and
--    deletes those orphaned asset rows too — shared assets and assets still
--    referenced by another question, option or stimulus survive. Storage
--    object cleanup for the returned paths happens in the calling application
--    code (src/lib/questions/bulk-mutations.ts) as a best-effort step after
--    this transaction commits, since Supabase Storage is not part of the
--    Postgres transaction.
--
-- Both functions run SECURITY INVOKER (not the SECURITY DEFINER convention
-- used elsewhere in this codebase) precisely so they cannot bypass RLS: the
-- delete statements below execute as the calling user and are still subject to
-- the "questions_staff_delete" / "assets_staff_manage" policies. The explicit
-- staff-role check up front just gives a clearer error than a silent
-- zero-row delete would.

create or replace function public.classify_hard_delete_candidates(p_question_ids uuid[])
returns jsonb
language sql
security invoker
set search_path = public
stable
as $$
  with input_ids as (
    select distinct x as id from unnest(coalesce(p_question_ids, '{}'::uuid[])) as x
  ),
  found as (
    select q.id, q.status
    from public.questions q
    where q.id in (select id from input_ids)
  ),
  missing as (
    select i.id from input_ids i where not exists (select 1 from found f where f.id = i.id)
  ),
  invalid_state as (
    select f.id from found f where f.status <> 'archived'
  ),
  candidates as (
    select f.id from found f where f.status = 'archived'
  ),
  candidate_reasons as (
    select
      c.id,
      (
        select jsonb_agg(reason)
        from (
          select 'student_attempts' as reason
          where exists (select 1 from public.question_attempts a where a.question_id = c.id)
          union all
          select 'revision_records'
          where exists (select 1 from public.student_mistake_questions m where m.question_id = c.id)
          union all
          select 'mock_exam_sessions'
          where exists (select 1 from public.mock_exam_session_questions s where s.question_id = c.id)
          union all
          select 'curated_mock_tests'
          where exists (select 1 from public.mock_test_questions t where t.question_id = c.id)
        ) reasons
      ) as reasons
    from candidates c
  ),
  blocked_only as (
    select id, reasons from candidate_reasons where reasons is not null
  ),
  eligible as (
    select c.id from candidates c where not exists (select 1 from blocked_only b where b.id = c.id)
  )
  select jsonb_build_object(
    'requestedCount', (select count(*) from input_ids),
    'existingIds', coalesce((select jsonb_agg(id) from found), '[]'::jsonb),
    'missingIds', coalesce((select jsonb_agg(id) from missing), '[]'::jsonb),
    'invalidStateIds', coalesce((select jsonb_agg(id) from invalid_state), '[]'::jsonb),
    'eligibleIds', coalesce((select jsonb_agg(id) from eligible), '[]'::jsonb),
    'blocked', coalesce(
      (select jsonb_agg(jsonb_build_object('questionId', id, 'reasons', reasons)) from blocked_only),
      '[]'::jsonb
    )
  );
$$;

grant execute on function public.classify_hard_delete_candidates(uuid[]) to authenticated;

create or replace function public.hard_delete_questions(p_question_ids uuid[])
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_ids uuid[] := coalesce((select array_agg(distinct x) from unnest(p_question_ids) as x), '{}'::uuid[]);
  v_classification jsonb;
  v_candidate_asset_ids uuid[];
  v_deleted_ids uuid[];
  v_orphaned_assets jsonb;
begin
  if public.get_current_user_role() not in ('tutor', 'admin', 'super_admin') then
    raise exception 'Only staff can permanently delete questions.';
  end if;

  if array_length(v_ids, 1) is null then
    return jsonb_build_object(
      'requestedCount', 0,
      'deletedIds', '[]'::jsonb,
      'deletedCount', 0,
      'blocked', '[]'::jsonb,
      'missingIds', '[]'::jsonb,
      'invalidStateIds', '[]'::jsonb,
      'orphanedAssets', '[]'::jsonb
    );
  end if;

  -- Informational only: reported to the caller as-is. The delete below does
  -- NOT rely on this snapshot for its own safety — see the atomic WHERE
  -- clause a few statements down.
  v_classification := public.classify_hard_delete_candidates(v_ids);

  -- Assets owned by the requested questions, captured before the cascade below
  -- can remove the question_assets/question_options rows that reference them.
  -- Harmless to include assets belonging to questions that turn out blocked —
  -- their link rows survive (that question was never deleted), so the
  -- not-referenced-anywhere check after the delete naturally excludes them.
  select coalesce(array_agg(distinct asset_id), '{}'::uuid[]) into v_candidate_asset_ids
  from (
    select asset_id from public.question_assets where question_id = any(v_ids)
    union
    select asset_id from public.question_options where question_id = any(v_ids) and asset_id is not null
  ) owned;

  -- Atomic eligibility + delete: "archived" and all four history-absence
  -- checks are evaluated in the SAME statement/snapshot as the delete, so a
  -- row that gained a new attempt/mistake/mock-session/curated-mock link after
  -- classify() ran above a moment ago is still protected — the delete simply
  -- will not match it. This is what actually closes the check-then-delete
  -- race, not the classify() call above.
  with deletable as (
    select q.id
    from public.questions q
    where q.id = any(v_ids)
      and q.status = 'archived'
      and not exists (select 1 from public.question_attempts a where a.question_id = q.id)
      and not exists (select 1 from public.student_mistake_questions m where m.question_id = q.id)
      and not exists (select 1 from public.mock_exam_session_questions s where s.question_id = q.id)
      and not exists (select 1 from public.mock_test_questions t where t.question_id = q.id)
  ),
  removed as (
    delete from public.questions
    where id in (select id from deletable)
    returning id
  )
  select coalesce(array_agg(id), '{}'::uuid[]) into v_deleted_ids from removed;

  -- Orphan cleanup: candidate assets now referenced by nothing at all. Checks
  -- ALL asset-reference surfaces, not just question_assets — an asset shared
  -- with another question (question_assets), used as a visual answer option
  -- (question_options.asset_id) or still attached to a stimulus
  -- (stimulus_assets) must survive.
  with orphan_candidates as (
    select a.id
    from unnest(v_candidate_asset_ids) as a(id)
    where not exists (select 1 from public.question_assets qa where qa.asset_id = a.id)
      and not exists (select 1 from public.question_options qo where qo.asset_id = a.id)
      and not exists (select 1 from public.stimulus_assets sa where sa.asset_id = a.id)
  ),
  removed_assets as (
    delete from public.assets
    where id in (select id from orphan_candidates)
    returning id, storage_path, external_url, asset_type
  )
  select coalesce(
    jsonb_agg(jsonb_build_object(
      'id', id,
      'storagePath', storage_path,
      'externalUrl', external_url,
      'assetType', asset_type
    )),
    '[]'::jsonb
  )
  into v_orphaned_assets
  from removed_assets;

  return jsonb_build_object(
    'requestedCount', coalesce(array_length(v_ids, 1), 0),
    'deletedIds', to_jsonb(v_deleted_ids),
    'deletedCount', coalesce(array_length(v_deleted_ids, 1), 0),
    'blocked', v_classification->'blocked',
    'missingIds', v_classification->'missingIds',
    'invalidStateIds', v_classification->'invalidStateIds',
    'orphanedAssets', v_orphaned_assets
  );
end;
$$;

grant execute on function public.hard_delete_questions(uuid[]) to authenticated;
