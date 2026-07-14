-- Question validation status — content-quality sign-off, orthogonal to lifecycle.
--
-- The existing `questions.status` column tracks the publishing lifecycle
-- (draft -> reviewed -> published -> archived). It does NOT record whether a
-- question's *content* has been checked for correctness by a human. The
-- Question-Bank Coverage Dashboard treats "validated + published + asset-ready"
-- as the definition of a genuinely usable question, so we need a first-class,
-- filterable validation signal that is independent of the publish state.
--
-- Design notes:
--  * Unlike the editable taxonomy labels, this is a small fixed lifecycle, so a
--    CHECK constraint is appropriate. The allowed values mirror VALIDATION_STATUSES
--    in src/lib/types.ts (the single source of truth for the app layer).
--  * Existing rows default to 'unreviewed' — honest: nothing has been validated
--    yet. Coverage counts and the audit surface this rather than assuming quality.
--  * validated_at / validated_by capture who signed a question off, matching the
--    resolved_by/resolved_at pattern on question_reports.

alter table public.questions
  add column if not exists validation_status text not null default 'unreviewed';

alter table public.questions
  add column if not exists validated_at timestamptz;

alter table public.questions
  add column if not exists validated_by uuid references public.profiles(id) on delete set null;

-- Idempotent CHECK constraint (ADD CONSTRAINT has no IF NOT EXISTS).
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'questions_validation_status_check'
  ) then
    alter table public.questions
      add constraint questions_validation_status_check
      check (validation_status in ('unreviewed', 'validated', 'needs_fixes'));
  end if;
end $$;

-- Coverage queries filter live (non-deleted) questions by validation status.
create index if not exists idx_questions_validation_status
  on public.questions(validation_status)
  where deleted_at is null;

comment on column public.questions.validation_status is
  'Content sign-off state (src/lib/types VALIDATION_STATUSES): unreviewed | validated | needs_fixes. Independent of the publish lifecycle in status.';
comment on column public.questions.validated_at is
  'When the question was last marked validated (or NULL if never).';
comment on column public.questions.validated_by is
  'Profile that last marked the question validated (NULL if never / cleared).';
