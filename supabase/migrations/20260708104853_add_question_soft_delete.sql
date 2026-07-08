-- Soft delete (trash) for questions.
--
-- Admins can already archive a question (status = 'archived'); this adds a
-- reversible "move to trash" step on top of that. Soft delete is orthogonal to
-- the draft -> reviewed -> published -> archived lifecycle: a trashed question
-- KEEPS its status (always 'archived' in practice, since the app only allows
-- deleting archived questions) and simply gains a deleted_at stamp. This keeps
-- the pre-delete state intact so restore just clears the stamp, and avoids
-- overloading the status check constraint with a 'deleted' value.
--
-- Nothing is destroyed: options, stimuli, assets, attempts, mock history and
-- analytics rows are untouched. Trashed questions are hidden from admin lists,
-- student practice, revision and mock selection by app queries filtering on
-- deleted_at IS NULL (and, for students, status = 'published', which a trashed
-- archived row can never be).

alter table public.questions
  add column if not exists deleted_at timestamptz;
alter table public.questions
  add column if not exists deleted_by uuid references public.profiles(id) on delete set null;
alter table public.questions
  add column if not exists delete_reason text;

-- Almost every read filters out trash, so index the common "not deleted" case.
create index if not exists idx_questions_not_deleted
  on public.questions(deleted_at)
  where deleted_at is null;
