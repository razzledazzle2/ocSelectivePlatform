-- Storage bucket for question-bank media (diagrams, charts, visual options).
--
-- Private bucket: files are served to signed-in users only (students need the
-- images of published questions; the app fetches via the authenticated client).
-- Staff (tutor/admin/super_admin) upload/manage files. assets.storage_path in
-- public.assets points at objects in this bucket.

insert into storage.buckets (id, name, public)
values ('question-media', 'question-media', false)
on conflict (id) do nothing;

drop policy if exists "question_media_read_authenticated" on storage.objects;
create policy "question_media_read_authenticated"
on storage.objects
for select
to authenticated
using (bucket_id = 'question-media');

drop policy if exists "question_media_staff_insert" on storage.objects;
create policy "question_media_staff_insert"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'question-media'
  and public.get_current_user_role() in ('tutor', 'admin', 'super_admin')
);

drop policy if exists "question_media_staff_update" on storage.objects;
create policy "question_media_staff_update"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'question-media'
  and public.get_current_user_role() in ('tutor', 'admin', 'super_admin')
)
with check (
  bucket_id = 'question-media'
  and public.get_current_user_role() in ('tutor', 'admin', 'super_admin')
);

drop policy if exists "question_media_staff_delete" on storage.objects;
create policy "question_media_staff_delete"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'question-media'
  and public.get_current_user_role() in ('tutor', 'admin', 'super_admin')
);
