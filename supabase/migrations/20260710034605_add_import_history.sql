-- Import history: one row per CSV/paste/zip import run, for audit and the
-- admin "Import history" page. Append-only — no update/delete policy.

create table if not exists public.import_batches (
  id uuid primary key default gen_random_uuid(),
  filename text not null,
  import_mode text not null check (import_mode in ('create', 'update', 'create_and_update')),
  blank_cell_behavior text not null default 'keep' check (blank_cell_behavior in ('keep', 'clear')),
  uploaded_by uuid references public.profiles(id) on delete set null,
  questions_created integer not null default 0,
  questions_updated integer not null default 0,
  questions_unchanged integer not null default 0,
  questions_rejected integer not null default 0,
  assets_uploaded integer not null default 0,
  assets_rejected integer not null default 0,
  error_summary jsonb not null default '[]'::jsonb,
  final_status text not null check (final_status in ('completed', 'completed_with_errors', 'failed')),
  created_at timestamptz not null default now()
);

create index if not exists idx_import_batches_created_at on public.import_batches(created_at desc);

alter table public.import_batches enable row level security;

drop policy if exists "import_batches_staff_select" on public.import_batches;
create policy "import_batches_staff_select"
on public.import_batches
for select
to authenticated
using (public.get_current_user_role() in ('tutor', 'admin', 'super_admin'));

drop policy if exists "import_batches_staff_insert" on public.import_batches;
create policy "import_batches_staff_insert"
on public.import_batches
for insert
to authenticated
with check (
  public.get_current_user_role() in ('tutor', 'admin', 'super_admin')
  and uploaded_by = auth.uid()
);
