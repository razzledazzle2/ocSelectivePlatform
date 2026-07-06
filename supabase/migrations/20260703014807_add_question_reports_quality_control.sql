-- Phase 9: Question Reports and Quality Control
-- Lets students and staff report question issues, and gives staff a review queue.

create table if not exists public.question_reports (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions(id) on delete cascade,
  reporter_id uuid references public.profiles(id) on delete set null,
  report_type text not null,
  message text,
  status text not null default 'open',
  assigned_to uuid references public.profiles(id) on delete set null,
  resolved_by uuid references public.profiles(id) on delete set null,
  resolved_at timestamptz,
  internal_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint question_reports_report_type_check check (
    report_type in (
      'wrong_answer',
      'unclear_solution',
      'typo',
      'multiple_correct_answers',
      'confusing_wording',
      'image_or_diagram_issue',
      'other'
    )
  ),

  constraint question_reports_status_check check (
    status in (
      'open',
      'in_review',
      'resolved',
      'dismissed'
    )
  )
);

create index if not exists idx_question_reports_question_id on public.question_reports(question_id);
create index if not exists idx_question_reports_reporter_id on public.question_reports(reporter_id);
create index if not exists idx_question_reports_status on public.question_reports(status);
create index if not exists idx_question_reports_report_type on public.question_reports(report_type);
create index if not exists idx_question_reports_assigned_to on public.question_reports(assigned_to);
create index if not exists idx_question_reports_created_at on public.question_reports(created_at desc);

-- Reuse the existing shared updated_at trigger helper (public.set_updated_at()).
drop trigger if exists question_reports_set_updated_at on public.question_reports;
create trigger question_reports_set_updated_at
before update on public.question_reports
for each row
execute function public.set_updated_at();

alter table public.question_reports enable row level security;

grant select, insert, update on public.question_reports to authenticated;
grant delete on public.question_reports to service_role;

-- Any authenticated user (typically students, but tutors/admins too) can create a
-- report, and only for themselves as the reporter.
drop policy if exists "question_reports_create_own" on public.question_reports;
create policy "question_reports_create_own"
on public.question_reports
for insert
to authenticated
with check (reporter_id = auth.uid());

-- Reporters can read their own reports; staff can read all reports.
drop policy if exists "question_reports_read_own_or_staff" on public.question_reports;
create policy "question_reports_read_own_or_staff"
on public.question_reports
for select
to authenticated
using (
  reporter_id = auth.uid()
  or public.get_current_user_role() in ('tutor', 'admin', 'super_admin')
);

-- Only staff can triage/update reports (status, assignment, internal notes, resolution).
drop policy if exists "question_reports_staff_update" on public.question_reports;
create policy "question_reports_staff_update"
on public.question_reports
for update
to authenticated
using (public.get_current_user_role() in ('tutor', 'admin', 'super_admin'))
with check (public.get_current_user_role() in ('tutor', 'admin', 'super_admin'));

-- Hard delete is intentionally restricted to admins/super_admins only. Prefer
-- 'dismissed' status over deleting; this policy exists only as a safety valve.
drop policy if exists "question_reports_admin_delete" on public.question_reports;
create policy "question_reports_admin_delete"
on public.question_reports
for delete
to authenticated
using (public.get_current_user_role() in ('admin', 'super_admin'));
