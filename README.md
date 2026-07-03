# OC Selective Platform

Next.js App Router and Supabase foundation for an OC and Selective tutoring platform with:

- shared login for students and staff
- `profiles.role` driven redirects and route protection
- admin question management
- CSV preview and import for question bulk upload
- student practice, attempt tracking, and mistake tracking

## Environment

Add these environment variables to `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

## Create an admin user

1. Create the user in Supabase Auth through the app signup flow or the Supabase dashboard.
   A matching `public.profiles` row (default `role = 'student'`) is created automatically by
   the `on_auth_user_created` trigger, so the promotion query below always has a row to update.
2. Promote the user in SQL:

```sql
update public.profiles
set role = 'admin'
where email = 'admin@example.com';
```

3. Sign in through `/login`. The user will be redirected to `/admin/dashboard`.

Tutors can be created the same way by setting `role = 'tutor'`.

## Test admin login

1. Create a normal account through `/signup`.
2. Promote that account in Supabase with the SQL above.
3. Sign out and sign back in through `/login`.
4. Confirm the user lands on `/admin/dashboard` and can open `/admin/questions` and `/admin/students`.

## Test CSV upload

1. Sign in as an admin, tutor, or super admin.
2. Open `/admin/questions`.
3. Upload a `.csv` file with the required columns.
4. Use the preview action first.
5. Confirm row-level validation errors are shown for invalid rows.
6. Import the valid rows and confirm the success summary appears.
7. Refresh the question list and confirm the new questions appear.

## Test student practice and attempt tracking

1. Sign in as a student.
2. Open `/student/practice`.
3. Start a practice set with a subject and optional topic/difficulty filter.
4. Submit answers, including at least one incorrect answer.
5. Finish the session and confirm the summary appears.
6. Open `/student/dashboard` and confirm the stats update.
7. Open `/student/revision` and confirm incorrect questions appear in the mistake queue.

## Database migrations

The existing pushed migrations were left untouched.

Pending migration to push:

- `supabase/migrations/20260703020522_add_profile_creation_trigger.sql` — hardens the
  new-user trigger (auto-creates a `profiles` row, `role = 'student'` by default) and
  backfills profiles for any existing auth users that are missing one.

Review it, then push with:

```bash
supabase db push
```
