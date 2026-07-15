-- Reading question sets: ordered multi-question passage/insertion sets with
-- delayed (after-set) grading, dynamic answer options up to A-G, a shared
-- sentence-option bank for sentence-insertion, and in-progress set persistence.
--
-- Backward compatibility is total:
--   * Every existing question, option, attempt and practice flow is untouched.
--   * A question that belongs to no question_set behaves exactly as before.
--   * Existing A-E imports keep importing -- the option ceiling only WIDENS.
--
-- Design decisions:
--   1. Options grow A-E -> A-G by widening the existing CHECK constraints only.
--      QUESTION_OPTION_LABELS in src/lib/types.ts is the app-side source of truth.
--   2. Reading sets reuse the existing `stimuli` entity for the passage and its
--      attribution (stimuli.source_info jsonb -- no new column needed).
--   3. A `question_sets` row groups questions; `question_set_items` links each
--      question with its order + optional target gap label. No stimulus text or
--      option text is duplicated -- the set points at the shared stimulus/pool.
--   4. `shared_option_pools` holds the A-G sentence bank for sentence-insertion
--      once (referenced by many child questions), never duplicated per question.
--   5. `practice_set_answers` autosaves in-progress answers against a normal
--      `practice_sessions` row so a reading set can be graded only on submission,
--      resumed after leaving, and produce a set-level result -- while every graded
--      answer still becomes an ordinary `question_attempts` row for analytics.

-- ---------------------------------------------------------------------------
-- 1. Widen answer-option label checks A-E -> A-G (options never shrink)
-- ---------------------------------------------------------------------------
alter table public.question_options
  drop constraint if exists question_options_label_check;
alter table public.question_options
  add constraint question_options_label_check
  check (label in ('A', 'B', 'C', 'D', 'E', 'F', 'G'));

alter table public.questions
  drop constraint if exists questions_correct_option_label_check;
alter table public.questions
  add constraint questions_correct_option_label_check
  check (correct_option_label in ('A', 'B', 'C', 'D', 'E', 'F', 'G'));

alter table public.question_attempts
  drop constraint if exists question_attempts_selected_option_label_check;
alter table public.question_attempts
  add constraint question_attempts_selected_option_label_check
  check (selected_option_label in ('A', 'B', 'C', 'D', 'E', 'F', 'G'));

alter table public.question_attempts
  drop constraint if exists question_attempts_correct_option_label_check;
alter table public.question_attempts
  add constraint question_attempts_correct_option_label_check
  check (correct_option_label in ('A', 'B', 'C', 'D', 'E', 'F', 'G'));

alter table public.mock_exam_session_questions
  drop constraint if exists mock_exam_session_questions_selected_option_label_check;
alter table public.mock_exam_session_questions
  add constraint mock_exam_session_questions_selected_option_label_check
  check (selected_option_label is null or selected_option_label in ('A', 'B', 'C', 'D', 'E', 'F', 'G'));

-- ---------------------------------------------------------------------------
-- 2. Shared option pools (sentence-insertion A-G sentence bank)
-- ---------------------------------------------------------------------------
create table if not exists public.shared_option_pools (
  id uuid primary key default gen_random_uuid(),
  external_ref text unique,
  title text,
  -- Ordered [{ "label": "A", "text": "..." }, ...]; the label domain is A-G.
  options jsonb not null default '[]',
  metadata jsonb not null default '{}',
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 3. Question sets + items
-- ---------------------------------------------------------------------------
create table if not exists public.question_sets (
  id uuid primary key default gen_random_uuid(),
  external_ref text unique,
  title text not null,
  set_type text not null default 'reading_passage',
  instructions text,
  feedback_mode text not null default 'after_set',
  completion_mode text not null default 'free_navigation',
  interaction_type text,
  stimulus_id uuid references public.stimuli(id) on delete set null,
  shared_option_pool_id uuid references public.shared_option_pools(id) on delete set null,
  source_info jsonb not null default '{}',
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint question_sets_set_type_check check (
    set_type in ('reading_passage', 'sentence_insertion', 'generic')
  ),
  constraint question_sets_feedback_mode_check check (
    feedback_mode in ('immediate', 'after_set')
  ),
  constraint question_sets_completion_mode_check check (
    completion_mode in ('free_navigation', 'sequential', 'all_required')
  )
);

create table if not exists public.question_set_items (
  id uuid primary key default gen_random_uuid(),
  set_id uuid not null references public.question_sets(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete cascade,
  position integer not null default 0,
  -- e.g. the numbered gap a sentence-insertion child question fills ("23").
  target_label text,
  created_at timestamptz not null default now(),
  unique (set_id, question_id),
  unique (question_id)
);

-- ---------------------------------------------------------------------------
-- 4. In-progress reading-set answers (autosave + resume + delayed grading)
-- ---------------------------------------------------------------------------
create table if not exists public.practice_set_answers (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.practice_sessions(id) on delete cascade,
  set_id uuid references public.question_sets(id) on delete set null,
  question_id uuid not null references public.questions(id) on delete cascade,
  position integer not null default 0,
  selected_option_label text,
  time_spent_seconds integer not null default 0,
  -- Flips true exactly once, when the parent set is submitted and graded.
  is_submitted boolean not null default false,
  is_correct boolean,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (session_id, question_id),
  constraint practice_set_answers_selected_option_label_check
    check (selected_option_label is null or selected_option_label in ('A', 'B', 'C', 'D', 'E', 'F', 'G')),
  constraint practice_set_answers_time_spent_check check (time_spent_seconds >= 0)
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------
create index if not exists idx_question_sets_set_type on public.question_sets(set_type);
create index if not exists idx_question_sets_stimulus_id on public.question_sets(stimulus_id);
create index if not exists idx_question_set_items_set_id on public.question_set_items(set_id);
create index if not exists idx_question_set_items_question_id on public.question_set_items(question_id);
create index if not exists idx_practice_set_answers_session_id on public.practice_set_answers(session_id);
create index if not exists idx_practice_set_answers_set_id on public.practice_set_answers(set_id);

-- ---------------------------------------------------------------------------
-- Triggers (reuse public.set_updated_at)
-- ---------------------------------------------------------------------------
drop trigger if exists shared_option_pools_set_updated_at on public.shared_option_pools;
create trigger shared_option_pools_set_updated_at
before update on public.shared_option_pools
for each row execute function public.set_updated_at();

drop trigger if exists question_sets_set_updated_at on public.question_sets;
create trigger question_sets_set_updated_at
before update on public.question_sets
for each row execute function public.set_updated_at();

drop trigger if exists practice_set_answers_set_updated_at on public.practice_set_answers;
create trigger practice_set_answers_set_updated_at
before update on public.practice_set_answers
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.shared_option_pools enable row level security;
alter table public.question_sets enable row level security;
alter table public.question_set_items enable row level security;
alter table public.practice_set_answers enable row level security;

grant select, insert, update, delete on public.shared_option_pools to authenticated;
grant select, insert, update, delete on public.question_sets to authenticated;
grant select, insert, update, delete on public.question_set_items to authenticated;
grant select, insert, update, delete on public.practice_set_answers to authenticated;

-- Shared option pools: readable to any signed-in user (mirrors assets), staff manage.
drop policy if exists "shared_option_pools_read_authenticated" on public.shared_option_pools;
create policy "shared_option_pools_read_authenticated"
on public.shared_option_pools
for select
to authenticated
using (true);

drop policy if exists "shared_option_pools_staff_manage" on public.shared_option_pools;
create policy "shared_option_pools_staff_manage"
on public.shared_option_pools
for all
to authenticated
using (public.get_current_user_role() in ('tutor', 'admin', 'super_admin'))
with check (public.get_current_user_role() in ('tutor', 'admin', 'super_admin'));

-- Question sets: students may read a set only when it has a published question;
-- staff read/manage everything (mirrors the stimuli policy).
drop policy if exists "question_sets_read_published_or_staff" on public.question_sets;
create policy "question_sets_read_published_or_staff"
on public.question_sets
for select
to authenticated
using (
  public.get_current_user_role() in ('tutor', 'admin', 'super_admin')
  or exists (
    select 1
    from public.question_set_items item
    join public.questions question_record on question_record.id = item.question_id
    where item.set_id = question_sets.id
      and question_record.status = 'published'
  )
);

drop policy if exists "question_sets_staff_manage" on public.question_sets;
create policy "question_sets_staff_manage"
on public.question_sets
for all
to authenticated
using (public.get_current_user_role() in ('tutor', 'admin', 'super_admin'))
with check (public.get_current_user_role() in ('tutor', 'admin', 'super_admin'));

drop policy if exists "question_set_items_read_published_or_staff" on public.question_set_items;
create policy "question_set_items_read_published_or_staff"
on public.question_set_items
for select
to authenticated
using (
  public.get_current_user_role() in ('tutor', 'admin', 'super_admin')
  or exists (
    select 1
    from public.questions question_record
    where question_record.id = question_set_items.question_id
      and question_record.status = 'published'
  )
);

drop policy if exists "question_set_items_staff_manage" on public.question_set_items;
create policy "question_set_items_staff_manage"
on public.question_set_items
for all
to authenticated
using (public.get_current_user_role() in ('tutor', 'admin', 'super_admin'))
with check (public.get_current_user_role() in ('tutor', 'admin', 'super_admin'));

-- Practice set answers: owned via the parent practice session (mirrors
-- mock_exam_session_questions).
drop policy if exists "practice_set_answers_create_own" on public.practice_set_answers;
create policy "practice_set_answers_create_own"
on public.practice_set_answers
for insert
to authenticated
with check (
  exists (
    select 1
    from public.practice_sessions session
    where session.id = practice_set_answers.session_id
      and session.student_id = auth.uid()
  )
);

drop policy if exists "practice_set_answers_read_own_or_staff" on public.practice_set_answers;
create policy "practice_set_answers_read_own_or_staff"
on public.practice_set_answers
for select
to authenticated
using (
  exists (
    select 1
    from public.practice_sessions session
    where session.id = practice_set_answers.session_id
      and (
        session.student_id = auth.uid()
        or public.get_current_user_role() in ('tutor', 'admin', 'super_admin')
      )
  )
);

drop policy if exists "practice_set_answers_update_own" on public.practice_set_answers;
create policy "practice_set_answers_update_own"
on public.practice_set_answers
for update
to authenticated
using (
  exists (
    select 1
    from public.practice_sessions session
    where session.id = practice_set_answers.session_id
      and session.student_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.practice_sessions session
    where session.id = practice_set_answers.session_id
      and session.student_id = auth.uid()
  )
);
