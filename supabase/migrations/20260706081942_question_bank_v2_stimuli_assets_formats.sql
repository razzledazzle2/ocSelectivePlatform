-- Question bank v2: shared stimuli, media assets, answer formats, richer taxonomy.
--
-- 1. stimuli: reusable content (passages, poems, tables, charts, logic grids,
--    writing contexts) shared by many questions instead of duplicating
--    passage_text per question. questions.passage_text stays as a legacy
--    fallback; renderers prefer the linked stimulus.
-- 2. assets: images/diagrams/SVGs/charts referenced by stimuli, questions,
--    options or solutions. An asset may be 'pending' (created from a CSV
--    reference before the file is uploaded) — imports never break on missing
--    files. external_ref stores the CSV reference (e.g. asset://pending/x.svg).
-- 3. Link tables (question_assets with a question/solution role,
--    stimulus_assets) keep FK integrity; question_options.asset_id supports
--    visual answer options.
-- 4. questions gains: answer_format (single_choice | extended_response),
--    marks, time_limit_seconds, external_id (import/export round-trip key),
--    stimulus_id, variant_id, skill_tags/concept_tags, rubric (writing
--    marking criteria as jsonb), presentation (input/display hints),
--    source_info (provenance). correct_option_label / worked_solution become
--    nullable so extended_response (writing prompt) rows are storable; a
--    check constraint still requires a correct label for single_choice.
-- 5. Question lifecycle gains a 'reviewed' stage between draft and published.
--    Students still only ever read 'published' (RLS unchanged).
-- 6. Taxonomy: topics.strand groups topics inside a subject; question_types
--    gains authoring metadata (common_trap, difficulty range, recommended
--    answer format, assets_commonly_needed); question_variants adds a
--    variant level under each essential question type.

-- ---------------------------------------------------------------------------
-- 1. Stimuli
-- ---------------------------------------------------------------------------
create table if not exists public.stimuli (
  id uuid primary key default gen_random_uuid(),
  external_ref text unique,
  title text not null,
  stimulus_type text not null,
  body_markdown text,
  source_info jsonb not null default '{}',
  status text not null default 'active',
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint stimuli_type_check check (
    stimulus_type in (
      'passage', 'paired_extract', 'poem', 'information_text', 'cloze_passage',
      'table', 'chart', 'logic_grid', 'rule_box', 'writing_context', 'image_set'
    )
  ),
  constraint stimuli_status_check check (status in ('active', 'archived'))
);

-- ---------------------------------------------------------------------------
-- 2. Assets
-- ---------------------------------------------------------------------------
create table if not exists public.assets (
  id uuid primary key default gen_random_uuid(),
  external_ref text unique,
  asset_type text not null default 'image',
  storage_path text,
  external_url text,
  alt_text text,
  generation_prompt text,
  license_notes text,
  metadata jsonb not null default '{}',
  status text not null default 'pending',
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint assets_type_check check (
    asset_type in ('image', 'diagram', 'svg', 'table', 'chart', 'audio')
  ),
  constraint assets_status_check check (status in ('pending', 'uploaded', 'archived'))
);

-- ---------------------------------------------------------------------------
-- 3. Link tables + visual options
-- ---------------------------------------------------------------------------
create table if not exists public.stimulus_assets (
  id uuid primary key default gen_random_uuid(),
  stimulus_id uuid not null references public.stimuli(id) on delete cascade,
  asset_id uuid not null references public.assets(id) on delete cascade,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (stimulus_id, asset_id)
);

create table if not exists public.question_assets (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions(id) on delete cascade,
  asset_id uuid not null references public.assets(id) on delete cascade,
  role text not null default 'question',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (question_id, asset_id, role),
  constraint question_assets_role_check check (role in ('question', 'solution'))
);

alter table public.question_options
  add column if not exists asset_id uuid references public.assets(id) on delete set null;
alter table public.question_options
  add column if not exists explanation text;

-- ---------------------------------------------------------------------------
-- 4. Questions: formats, metadata, stimulus link
-- ---------------------------------------------------------------------------
alter table public.questions
  add column if not exists answer_format text not null default 'single_choice';
alter table public.questions
  add column if not exists marks integer not null default 1;
alter table public.questions
  add column if not exists time_limit_seconds integer;
alter table public.questions
  add column if not exists external_id text;
alter table public.questions
  add column if not exists stimulus_id uuid references public.stimuli(id) on delete set null;
alter table public.questions
  add column if not exists variant_id uuid;
alter table public.questions
  add column if not exists skill_tags text[] not null default '{}';
alter table public.questions
  add column if not exists concept_tags text[] not null default '{}';
alter table public.questions
  add column if not exists rubric jsonb;
alter table public.questions
  add column if not exists presentation jsonb not null default '{}';
alter table public.questions
  add column if not exists source_info jsonb not null default '{}';

alter table public.questions
  drop constraint if exists questions_answer_format_check;
alter table public.questions
  add constraint questions_answer_format_check
  check (answer_format in ('single_choice', 'extended_response'));

alter table public.questions
  drop constraint if exists questions_marks_check;
alter table public.questions
  add constraint questions_marks_check check (marks > 0);

alter table public.questions
  drop constraint if exists questions_time_limit_check;
alter table public.questions
  add constraint questions_time_limit_check
  check (time_limit_seconds is null or time_limit_seconds > 0);

create unique index if not exists idx_questions_external_id
  on public.questions(external_id)
  where external_id is not null;

-- Writing prompts have no options/answer key; MCQ rows must keep theirs.
alter table public.questions
  alter column correct_option_label drop not null;
alter table public.questions
  alter column worked_solution drop not null;

alter table public.questions
  drop constraint if exists questions_correct_label_by_format_check;
alter table public.questions
  add constraint questions_correct_label_by_format_check
  check (answer_format <> 'single_choice' or correct_option_label is not null);

-- 5. Lifecycle: draft -> reviewed -> published -> archived.
alter table public.questions
  drop constraint if exists questions_status_check;
alter table public.questions
  add constraint questions_status_check
  check (status in ('draft', 'reviewed', 'published', 'archived'));

-- ---------------------------------------------------------------------------
-- 6. Taxonomy: strands, question-type metadata, variants
-- ---------------------------------------------------------------------------
alter table public.topics
  add column if not exists strand text;

alter table public.question_types
  add column if not exists common_trap text;
alter table public.question_types
  add column if not exists difficulty_min integer;
alter table public.question_types
  add column if not exists difficulty_max integer;
alter table public.question_types
  add column if not exists recommended_answer_format text;
alter table public.question_types
  add column if not exists assets_commonly_needed boolean not null default false;

alter table public.question_types
  drop constraint if exists question_types_difficulty_range_check;
alter table public.question_types
  add constraint question_types_difficulty_range_check
  check (
    (difficulty_min is null or difficulty_min between 1 and 5)
    and (difficulty_max is null or difficulty_max between 1 and 5)
    and (difficulty_min is null or difficulty_max is null or difficulty_min <= difficulty_max)
  );

alter table public.question_types
  drop constraint if exists question_types_recommended_answer_format_check;
alter table public.question_types
  add constraint question_types_recommended_answer_format_check
  check (
    recommended_answer_format is null
    or recommended_answer_format in ('single_choice', 'extended_response')
  );

create table if not exists public.question_variants (
  id uuid primary key default gen_random_uuid(),
  question_type_id uuid not null references public.question_types(id) on delete cascade,
  name text not null,
  slug text not null,
  description text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (question_type_id, slug)
);

alter table public.questions
  drop constraint if exists questions_variant_id_fkey;
alter table public.questions
  add constraint questions_variant_id_fkey
  foreign key (variant_id) references public.question_variants(id) on delete set null;

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------
create index if not exists idx_stimuli_stimulus_type on public.stimuli(stimulus_type);
create index if not exists idx_stimuli_status on public.stimuli(status);
create index if not exists idx_assets_status on public.assets(status);
create index if not exists idx_stimulus_assets_stimulus_id on public.stimulus_assets(stimulus_id);
create index if not exists idx_stimulus_assets_asset_id on public.stimulus_assets(asset_id);
create index if not exists idx_question_assets_question_id on public.question_assets(question_id);
create index if not exists idx_question_assets_asset_id on public.question_assets(asset_id);
create index if not exists idx_question_options_asset_id on public.question_options(asset_id);
create index if not exists idx_questions_stimulus_id on public.questions(stimulus_id);
create index if not exists idx_questions_answer_format on public.questions(answer_format);
create index if not exists idx_questions_variant_id on public.questions(variant_id);
create index if not exists idx_questions_tags on public.questions using gin(tags);
create index if not exists idx_questions_skill_tags on public.questions using gin(skill_tags);
create index if not exists idx_questions_concept_tags on public.questions using gin(concept_tags);
create index if not exists idx_question_variants_question_type_id
  on public.question_variants(question_type_id);
-- Analytics-readiness: per-question accuracy/most-common-wrong-answer scans.
create index if not exists idx_question_attempts_question_correct
  on public.question_attempts(question_id, is_correct);

-- ---------------------------------------------------------------------------
-- Triggers (reuse public.set_updated_at)
-- ---------------------------------------------------------------------------
drop trigger if exists stimuli_set_updated_at on public.stimuli;
create trigger stimuli_set_updated_at
before update on public.stimuli
for each row execute function public.set_updated_at();

drop trigger if exists assets_set_updated_at on public.assets;
create trigger assets_set_updated_at
before update on public.assets
for each row execute function public.set_updated_at();

drop trigger if exists question_variants_set_updated_at on public.question_variants;
create trigger question_variants_set_updated_at
before update on public.question_variants
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.stimuli enable row level security;
alter table public.assets enable row level security;
alter table public.stimulus_assets enable row level security;
alter table public.question_assets enable row level security;
alter table public.question_variants enable row level security;

grant select, insert, update, delete on public.stimuli to authenticated;
grant select, insert, update, delete on public.assets to authenticated;
grant select, insert, update, delete on public.stimulus_assets to authenticated;
grant select, insert, update, delete on public.question_assets to authenticated;
grant select, insert, update, delete on public.question_variants to authenticated;

-- Students may read a stimulus only when a published question uses it;
-- staff read everything.
drop policy if exists "stimuli_read_published_or_staff" on public.stimuli;
create policy "stimuli_read_published_or_staff"
on public.stimuli
for select
to authenticated
using (
  public.get_current_user_role() in ('tutor', 'admin', 'super_admin')
  or exists (
    select 1
    from public.questions question_record
    where question_record.stimulus_id = stimuli.id
      and question_record.status = 'published'
  )
);

drop policy if exists "stimuli_staff_manage" on public.stimuli;
create policy "stimuli_staff_manage"
on public.stimuli
for all
to authenticated
using (public.get_current_user_role() in ('tutor', 'admin', 'super_admin'))
with check (public.get_current_user_role() in ('tutor', 'admin', 'super_admin'));

-- Asset metadata mirrors worked solutions: readable to any signed-in user
-- (students can already read worked_solution on published rows); staff manage.
drop policy if exists "assets_read_authenticated" on public.assets;
create policy "assets_read_authenticated"
on public.assets
for select
to authenticated
using (true);

drop policy if exists "assets_staff_manage" on public.assets;
create policy "assets_staff_manage"
on public.assets
for all
to authenticated
using (public.get_current_user_role() in ('tutor', 'admin', 'super_admin'))
with check (public.get_current_user_role() in ('tutor', 'admin', 'super_admin'));

drop policy if exists "stimulus_assets_read_authenticated" on public.stimulus_assets;
create policy "stimulus_assets_read_authenticated"
on public.stimulus_assets
for select
to authenticated
using (true);

drop policy if exists "stimulus_assets_staff_manage" on public.stimulus_assets;
create policy "stimulus_assets_staff_manage"
on public.stimulus_assets
for all
to authenticated
using (public.get_current_user_role() in ('tutor', 'admin', 'super_admin'))
with check (public.get_current_user_role() in ('tutor', 'admin', 'super_admin'));

drop policy if exists "question_assets_read_authenticated" on public.question_assets;
create policy "question_assets_read_authenticated"
on public.question_assets
for select
to authenticated
using (true);

drop policy if exists "question_assets_staff_manage" on public.question_assets;
create policy "question_assets_staff_manage"
on public.question_assets
for all
to authenticated
using (public.get_current_user_role() in ('tutor', 'admin', 'super_admin'))
with check (public.get_current_user_role() in ('tutor', 'admin', 'super_admin'));

drop policy if exists "question_variants_read_active_or_staff" on public.question_variants;
create policy "question_variants_read_active_or_staff"
on public.question_variants
for select
to authenticated
using (
  is_active
  or public.get_current_user_role() in ('tutor', 'admin', 'super_admin')
);

drop policy if exists "question_variants_staff_manage" on public.question_variants;
create policy "question_variants_staff_manage"
on public.question_variants
for all
to authenticated
using (public.get_current_user_role() in ('tutor', 'admin', 'super_admin'))
with check (public.get_current_user_role() in ('tutor', 'admin', 'super_admin'));
