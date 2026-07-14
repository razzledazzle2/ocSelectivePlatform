-- Canonical question taxonomy v1 — schema support.
--
-- Adds nullable, backward-compatible columns to public.questions for the
-- canonical Subject -> Domain -> Subtopic -> Skill model and the separate
-- metadata dimensions. Subject continues to use the existing subject_id FK.
--
-- Design notes:
--  * All new columns are NULLABLE text — taxonomy labels are editable, so we do
--    NOT use Postgres enums / CHECK constraints here. Valid values are enforced
--    in the application layer against src/lib/taxonomy (the single source of
--    truth). This keeps the taxonomy evolvable without destructive migrations.
--  * Existing question data is preserved. Legacy subject_id / topic_id /
--    question_type_id remain untouched; the backfill below only *fills* the new
--    columns where they are still NULL, derived from each question's legacy
--    topic / question_type slug via the same map used in TypeScript.
--  * Unmapped legacy values are left NULL and surfaced for review in the app —
--    never silently discarded.

-- 1) New columns ------------------------------------------------------------

alter table public.questions add column if not exists domain_code text;
alter table public.questions add column if not exists subtopic_code text;
alter table public.questions add column if not exists skill_code text;
alter table public.questions add column if not exists pattern_key text;
alter table public.questions add column if not exists question_family text;
-- Per-question stimulus type (canonical STIMULUS_FORMATS). Named *_format to
-- avoid confusion with the shared stimuli.stimulus_type on the stimuli table.
alter table public.questions add column if not exists stimulus_format text;
alter table public.questions add column if not exists stimulus_genre text;
alter table public.questions add column if not exists asset_render_method text;
-- Writing admin metadata (Writing is not a student-facing practice category yet).
alter table public.questions add column if not exists writing_form text;
alter table public.questions add column if not exists writing_purpose text;
alter table public.questions add column if not exists writing_prompt_stimulus text;

-- 2) Indexes for the new filter dimensions ---------------------------------

create index if not exists idx_questions_domain_code on public.questions(domain_code) where domain_code is not null;
create index if not exists idx_questions_subtopic_code on public.questions(subtopic_code) where subtopic_code is not null;
create index if not exists idx_questions_skill_code on public.questions(skill_code) where skill_code is not null;
create index if not exists idx_questions_question_family on public.questions(question_family) where question_family is not null;
create index if not exists idx_questions_stimulus_format on public.questions(stimulus_format) where stimulus_format is not null;
create index if not exists idx_questions_pattern_key on public.questions(pattern_key) where pattern_key is not null;

-- 3) Non-destructive backfill from legacy topic slugs -----------------------
-- Mirrors LEGACY_TAXONOMY in src/lib/taxonomy/canonical-taxonomy.ts.
-- Only rows whose domain_code is still NULL are touched.

with legacy_topic_map(slug, domain_code, subtopic_code, stimulus_genre) as (
  values
    -- Reading
    ('narrative-extracts', 'comprehension_comparison', 'single_extract_comprehension', 'narrative_fiction'),
    ('cloze-passage',      'cloze_language',           null,                            null),
    ('extracts',           'comprehension_comparison', null,                            null),
    ('paired-extracts',    'comprehension_comparison', 'paired_extract_comparison',     null),
    ('narrative',          'comprehension_comparison', null,                            'narrative_fiction'),
    ('poetry',             'poetry',                   null,                            'poetry'),
    ('information-texts',  'comprehension_comparison', null,                            'informative_text'),
    ('main-idea',          'comprehension_comparison', 'main_idea_and_theme',           null),
    ('inference',          'comprehension_comparison', 'inference_and_drawing_conclusions', null),
    ('vocabulary-in-context', 'comprehension_comparison', 'vocabulary_in_context',      null),
    ('author-purpose',     'comprehension_comparison', 'author_purpose_and_audience',   null),
    ('detail-questions',   'comprehension_comparison', 'evidence_and_information_retrieval', null),
    ('synonyms',           'cloze_language',           'vocabulary_and_precise_word_choice', null),
    ('antonyms',           'cloze_language',           'vocabulary_and_precise_word_choice', null),
    ('word-meaning',       'cloze_language',           'meaning_from_context',          null),
    -- Mathematical Reasoning
    ('arithmetic',             'number_algebra',        'arithmetic_number_reasoning', null),
    ('arithmetic-operations',  'number_algebra',        'arithmetic_number_reasoning', null),
    ('fractions-decimals',     'number_algebra',        null,                          null),
    ('fractions',              'number_algebra',        'fractions',                   null),
    ('decimals',               'number_algebra',        'decimals',                    null),
    ('percentages',            'number_algebra',        'percentages',                 null),
    ('fractions-decimals-percentages', 'number_algebra', null,                         null),
    ('ratio-rates',            'number_algebra',        'ratio_rates_proportion',      null),
    ('ratios',                 'number_algebra',        'ratio_rates_proportion',      null),
    ('algebra',                'number_algebra',        'algebra_and_unknowns',        null),
    ('patterns',               'number_algebra',        'patterns_and_sequences',      null),
    ('number-patterns',        'number_algebra',        'patterns_and_sequences',      null),
    ('area',                   'measurement_financial', 'area_and_perimeter',          null),
    ('perimeter',              'measurement_financial', 'area_and_perimeter',          null),
    ('area-perimeter',         'measurement_financial', 'area_and_perimeter',          null),
    ('time',                   'measurement_financial', 'time_and_timetables',         null),
    ('money',                  'measurement_financial', 'money_and_financial_mathematics', null),
    ('units-length',           'measurement_financial', 'length_mass_capacity',        null),
    ('volume',                 'measurement_financial', 'volume_and_capacity',         null),
    ('angles',                 'geometry_spatial',      'angles',                      null),
    ('symmetry-transformations', 'geometry_spatial',    'symmetry_and_transformations', null),
    ('coordinates',            'geometry_spatial',      'coordinates_and_direction',   null),
    ('geometry',               'geometry_spatial',      null,                          null),
    ('tables-graphs',          'data_probability',      'charts_and_graphs',           null),
    ('data-interpretation',    'data_probability',      'tables_and_data_interpretation', null),
    ('statistics',             'data_probability',      'statistics_and_averages',     null),
    ('probability',            'data_probability',      'probability',                 null),
    ('problem-solving-strategies', 'number_algebra',    null,                          null),
    -- Thinking Skills
    ('drawing-conclusions',    'logic_deduction',            'drawing_conclusions',              null),
    ('argument-analysis',      'arguments_evidence',         'identifying_conclusions_and_claims', null),
    ('arguments',              'arguments_evidence',         null,                               null),
    ('argument-reasoning',     'arguments_evidence',         null,                               null),
    ('assumptions',            'arguments_evidence',         'identifying_assumptions',          null),
    ('strengthen-and-weaken',  'arguments_evidence',         'strengthening_arguments',          null),
    ('evidence-reasoning',     'arguments_evidence',         'evaluating_evidence',              null),
    ('logic',                  'logic_deduction',            null,                               null),
    ('logical-deduction',      'logic_deduction',            null,                               null),
    ('deduction',              'logic_deduction',            null,                               null),
    ('ordering-sets',          'logic_deduction',            'ordering_and_ranking',             null),
    ('truth-puzzles',          'logic_deduction',            'truth_and_lies',                   null),
    ('mathematical-analysis',  'quantitative_data_reasoning', null,                             null),
    ('problem-solving',        'quantitative_data_reasoning', null,                             null),
    ('abstract-reasoning',     'abstract_spatial_reasoning', null,                               null),
    ('spatial-reasoning',      'abstract_spatial_reasoning', null,                               null),
    ('pattern-recognition',    'abstract_spatial_reasoning', 'pattern_recognition',              null)
)
update public.questions q
set domain_code    = m.domain_code,
    subtopic_code  = m.subtopic_code,
    stimulus_genre = coalesce(q.stimulus_genre, m.stimulus_genre)
from public.topics t
join legacy_topic_map m on m.slug = t.slug
where q.topic_id = t.id
  and q.domain_code is null;

-- 4) Backfill writing_form from legacy writing question-type slugs ----------

with legacy_writing_form_map(slug, writing_form) as (
  values
    ('narrative',        'narrative'),
    ('description',      'description'),
    ('diary-entry',      'diary_entry'),
    ('recount',          'narrative'),
    ('persuasive',       'persuasive_response'),
    ('discursive',       'persuasive_response'),
    ('speech',           'speech'),
    ('letter',           'letter_or_email'),
    ('informative',      'informative_response'),
    ('newspaper-report', 'newspaper_report'),
    ('advice-sheet',     'advice_sheet')
)
update public.questions q
set writing_form = m.writing_form
from public.question_types qt
join public.subjects s on s.id = qt.subject_id and s.slug = 'writing'
join legacy_writing_form_map m on m.slug = qt.slug
where q.question_type_id = qt.id
  and q.writing_form is null;

comment on column public.questions.domain_code is 'Canonical taxonomy domain code (src/lib/taxonomy). Nullable; validated in app.';
comment on column public.questions.subtopic_code is 'Canonical taxonomy subtopic code (src/lib/taxonomy). Nullable; validated in app.';
comment on column public.questions.skill_code is 'Canonical taxonomy primary skill code (src/lib/taxonomy). Nullable; validated in app.';
comment on column public.questions.pattern_key is 'Free-form pattern key grouping near-identical question templates.';
comment on column public.questions.question_family is 'Structural question family code (src/lib/taxonomy QUESTION_FAMILIES).';
comment on column public.questions.stimulus_format is 'Per-question stimulus type code (src/lib/taxonomy STIMULUS_FORMATS).';
comment on column public.questions.stimulus_genre is 'Reading stimulus genre code (src/lib/taxonomy STIMULUS_GENRES).';
comment on column public.questions.asset_render_method is 'Asset render method code (src/lib/taxonomy ASSET_RENDER_METHODS).';
comment on column public.questions.writing_form is 'Writing form (admin metadata; src/lib/taxonomy WRITING_FORMS).';
comment on column public.questions.writing_purpose is 'Writing purpose (admin metadata; src/lib/taxonomy WRITING_PURPOSES).';
comment on column public.questions.writing_prompt_stimulus is 'Writing prompt stimulus (admin metadata; src/lib/taxonomy WRITING_PROMPT_STIMULI).';
