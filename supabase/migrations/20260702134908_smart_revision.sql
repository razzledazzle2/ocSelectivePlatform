-- Phase 2 + 3: smart revision fields for spaced-repetition style mistake review.

alter table public.student_mistake_questions
  add column if not exists next_review_at timestamptz,
  add column if not exists correct_streak integer not null default 0,
  add column if not exists last_reviewed_at timestamptz,
  add column if not exists mastered_at timestamptz;

-- Migrate any legacy status values to the new revision vocabulary before tightening the constraint.
update public.student_mistake_questions set status = 'learning' where status = 'reviewing';
update public.student_mistake_questions set status = 'improving' where status = 'improved';

alter table public.student_mistake_questions
  drop constraint if exists student_mistake_questions_status_check;

alter table public.student_mistake_questions
  add constraint student_mistake_questions_status_check
  check (status in ('needs_review', 'learning', 'improving', 'mastered'));

alter table public.student_mistake_questions
  drop constraint if exists student_mistake_questions_correct_streak_check;

alter table public.student_mistake_questions
  add constraint student_mistake_questions_correct_streak_check
  check (correct_streak >= 0);

create index if not exists idx_student_mistake_questions_next_review_at
  on public.student_mistake_questions(next_review_at);
