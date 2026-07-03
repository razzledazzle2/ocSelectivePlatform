-- Flexible answer options (A–E) + import source tracking + tags.
--
-- Different subjects use different option counts (Mathematical Reasoning uses
-- five options A–E; Thinking Skills / English / Reading use four A–D). The
-- schema already stores options in question_options, but five check
-- constraints hard-limited labels to A–D (verified against the live DB via
-- read-only MCP). This migration widens all of them to A–E, and adds:
--   - questions.source: how the question entered the bank (manual/csv/bulk_paste)
--   - questions.tags:   free-form labels for filtering/export
--
-- Subject-specific option-count rules (e.g. "Maths Reasoning prefers 5") are
-- enforced in app code (src/lib/questions/option-rules.ts), not in SQL, so
-- they stay configurable in one place.

-- 1. Widen option label checks from A–D to A–E.
alter table public.question_options
  drop constraint if exists question_options_label_check;
alter table public.question_options
  add constraint question_options_label_check
  check (label in ('A', 'B', 'C', 'D', 'E'));

alter table public.questions
  drop constraint if exists questions_correct_option_label_check;
alter table public.questions
  add constraint questions_correct_option_label_check
  check (correct_option_label in ('A', 'B', 'C', 'D', 'E'));

-- Attempt tracking must accept 'E' answers too, or submitting an E answer
-- fails at insert time even when the question itself is valid.
alter table public.question_attempts
  drop constraint if exists question_attempts_selected_option_label_check;
alter table public.question_attempts
  add constraint question_attempts_selected_option_label_check
  check (selected_option_label in ('A', 'B', 'C', 'D', 'E'));

alter table public.question_attempts
  drop constraint if exists question_attempts_correct_option_label_check;
alter table public.question_attempts
  add constraint question_attempts_correct_option_label_check
  check (correct_option_label in ('A', 'B', 'C', 'D', 'E'));

alter table public.mock_exam_session_questions
  drop constraint if exists mock_exam_session_questions_selected_option_label_check;
alter table public.mock_exam_session_questions
  add constraint mock_exam_session_questions_selected_option_label_check
  check (selected_option_label is null or selected_option_label in ('A', 'B', 'C', 'D', 'E'));

-- 2. Import source tracking (no 'ai' source yet — added later if AI import ships).
alter table public.questions
  add column if not exists source text not null default 'manual';

alter table public.questions
  drop constraint if exists questions_source_check;
alter table public.questions
  add constraint questions_source_check
  check (source in ('manual', 'csv', 'bulk_paste'));

-- 3. Tags for organising/exporting the bank.
alter table public.questions
  add column if not exists tags text[] not null default '{}';
