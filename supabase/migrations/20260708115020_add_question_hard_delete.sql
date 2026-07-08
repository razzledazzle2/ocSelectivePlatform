-- Hard delete (permanent) for questions.
--
-- Soft delete (deleted_at, migration 20260708104853) hides a question
-- reversibly. This adds an irreversible "delete forever" on top: an admin can
-- permanently remove an ARCHIVED question from the bank. The app layer only
-- allows it when the question has no student attempts, revision records, mock
-- session rows or curated-mock membership, so student history and analytics are
-- never destroyed by a purge (see hardDeleteQuestion in
-- src/lib/questions/mutations.ts). When a purge does run, the questions FKs
-- (all ON DELETE CASCADE) clean up its options, question<->asset links and
-- reports; shared asset rows themselves are untouched.
--
-- The base grant on public.questions is 'select, insert, update' only (see
-- migration 20260702110601), so DELETE has to be granted and RLS-gated here.

grant delete on public.questions to authenticated;

-- Only staff may delete, matching the create/update policies on this table.
drop policy if exists "questions_staff_delete" on public.questions;
create policy "questions_staff_delete"
on public.questions
for delete
to authenticated
using (public.get_current_user_role() in ('tutor', 'admin', 'super_admin'));
