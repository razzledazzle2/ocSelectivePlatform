-- Mock-Test Blueprints + externally-authored mock questions.
--
-- Two additive capabilities, no changes to how existing mocks work:
--
--  1. Deterministic mock BLUEPRINTS (rule-based, AI-free): a reusable spec of
--     domain/difficulty/subtopic/pattern targets the internal builder selects
--     against and CSV-imported mocks are validated against. Stored as a header
--     + a validated jsonb `spec` so new constraint kinds never need a migration.
--
--  2. External mock creation via CSV: a whole mock (including brand-new questions
--     that are NOT yet in the bank) can be imported. Because the student runner,
--     RLS, rendering, grading and review all key off public.questions.id, an
--     external question is still stored as a real question row — but tagged with
--     questions.origin = 'mock_import' so it is kept OUT of the general bank
--     browse / practice / random-mock / coverage pools until an admin explicitly
--     promotes it (origin = 'bank'). This gives the "separate question bank vs
--     mock content" separation with zero changes to the runner.
--
-- All columns are additive/defaulted; every existing mock and question is
-- unaffected (origin defaults to 'bank').

-- 1. Question origin: 'bank' (normal, browsable) vs 'mock_import' (lives only to
--    back a mock's questions until promoted). Default keeps all existing rows in
--    the bank exactly as before.
alter table public.questions
  add column if not exists origin text not null default 'bank'
    check (origin in ('bank', 'mock_import'));

-- Partial index so the bank/practice/coverage filters (origin = 'bank') stay cheap.
create index if not exists idx_questions_origin_mock_import
  on public.questions(origin)
  where origin = 'mock_import';

-- 2. Mock-test blueprints (admin-only; students never read these).
create table if not exists public.mock_blueprints (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  -- Optional exam-type scope; null = applies to either.
  exam_type text check (exam_type is null or exam_type in ('OC', 'Selective')),
  -- Canonical subject code the blueprint mainly targets (e.g. mathematical_reasoning,
  -- thinking_skills); nullable for cross-subject blueprints. Not a FK — subject
  -- codes are owned by src/lib/taxonomy, not a DB table.
  subject_code text,
  status text not null default 'draft' check (status in ('draft', 'active', 'archived')),
  -- The full deterministic rule set. Validated in TS against MockBlueprintSpec;
  -- jsonb so new constraint kinds are additive without a migration.
  spec jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_mock_blueprints_status on public.mock_blueprints(status);
create index if not exists idx_mock_blueprints_updated_at on public.mock_blueprints(updated_at desc);

drop trigger if exists mock_blueprints_set_updated_at on public.mock_blueprints;
create trigger mock_blueprints_set_updated_at
before update on public.mock_blueprints
for each row execute function public.set_updated_at();

alter table public.mock_blueprints enable row level security;
grant select, insert, update, delete on public.mock_blueprints to authenticated;

-- Blueprints are an authoring tool: staff only, no student access at all.
drop policy if exists "mock_blueprints_staff_manage" on public.mock_blueprints;
create policy "mock_blueprints_staff_manage"
on public.mock_blueprints
for all
to authenticated
using (public.get_current_user_role() in ('tutor', 'admin', 'super_admin'))
with check (public.get_current_user_role() in ('tutor', 'admin', 'super_admin'));

-- 3. Link a mock to its authoring provenance and (optionally) a blueprint.
--    external_id makes CSV round-trips idempotent: "update the mock whose
--    mock_external_id is X" matches on this. source records how it was authored.
alter table public.mock_tests
  add column if not exists external_id text;

alter table public.mock_tests
  add column if not exists blueprint_id uuid references public.mock_blueprints(id) on delete set null;

alter table public.mock_tests
  add column if not exists source text not null default 'builder'
    check (source in ('builder', 'csv_import'));

-- Unique when present (partial), so many builder-made mocks can share NULL but a
-- CSV mock_external_id maps to exactly one mock for idempotent re-import.
create unique index if not exists idx_mock_tests_external_id
  on public.mock_tests(external_id)
  where external_id is not null;

create index if not exists idx_mock_tests_blueprint_id on public.mock_tests(blueprint_id);
