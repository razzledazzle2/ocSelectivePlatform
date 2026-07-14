-- Mock test metadata: purpose, custom instructions, difficulty label, ordering.
--
-- The admin_curated_mock_tests migration modelled a mock as a header + ordered
-- sections + hand-picked questions. This adds product metadata the builder and
-- the student list need but the base schema could not express:
--
--   * mock_type       — the mock's purpose, so students and admins can tell a
--                       balanced diagnostic apart from a speed drill or a
--                       thinking-skills challenge, and coverage can be judged
--                       against intent.
--   * instructions    — free-text rules shown to the student before they begin
--                       (overrides the generic sectioned-mock instructions).
--   * difficulty_label — a human label (e.g. "Foundation", "Exam standard")
--                       surfaced as a badge; distinct from per-question 1–5.
--   * display_order   — admin-controlled ordering of the student mock list;
--                       lower shows first, ties broken by published_at.
--
-- All columns are additive and defaulted, so existing mocks keep working.

alter table public.mock_tests
  add column if not exists mock_type text not null default 'full_mock'
    check (mock_type in ('diagnostic', 'full_mock', 'topic_focus', 'speed_practice', 'challenge'));

alter table public.mock_tests
  add column if not exists instructions text;

alter table public.mock_tests
  add column if not exists difficulty_label text;

alter table public.mock_tests
  add column if not exists display_order integer not null default 0;

-- Student list ordering: published mocks by display_order, then most recent.
create index if not exists idx_mock_tests_display_order
  on public.mock_tests(status, display_order, published_at desc);

-- When a student sits an admin-curated mock, its sections are mirrored into
-- mock_exam_session_sections. Curated sections allow a 'custom' key, so the
-- session-section check must allow it too (it was reading/…/writing only).
alter table public.mock_exam_session_sections
  drop constraint if exists mock_exam_session_sections_section_key_check;
alter table public.mock_exam_session_sections
  add constraint mock_exam_session_sections_section_key_check
  check (section_key in ('reading', 'mathematical_reasoning', 'thinking_skills', 'writing', 'custom'));
