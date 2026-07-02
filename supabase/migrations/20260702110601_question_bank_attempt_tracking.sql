create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  role text not null default 'student',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles
drop constraint if exists profiles_role_check;

alter table public.profiles
add constraint profiles_role_check check (
  role in ('student', 'parent', 'tutor', 'admin', 'super_admin')
);

alter table public.profiles enable row level security;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.get_current_user_role()
returns text
language sql
security definer
set search_path = public
stable
as $$
  select role
  from public.profiles
  where id = auth.uid()
$$;

create table if not exists public.subjects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.topics (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references public.subjects(id) on delete cascade,
  name text not null,
  slug text not null,
  description text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (subject_id, slug)
);

create table if not exists public.question_types (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references public.subjects(id) on delete cascade,
  topic_id uuid references public.topics(id) on delete set null,
  name text not null,
  slug text not null,
  description text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (subject_id, slug)
);

create table if not exists public.questions (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references public.subjects(id) on delete restrict,
  topic_id uuid not null references public.topics(id) on delete restrict,
  question_type_id uuid references public.question_types(id) on delete set null,
  exam_type text not null,
  year_level integer,
  difficulty integer not null default 3,
  question_text text not null,
  passage_text text,
  short_explanation text,
  worked_solution text not null,
  correct_option_label text not null,
  status text not null default 'draft',
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  published_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint questions_exam_type_check check (exam_type in ('OC', 'Selective')),
  constraint questions_difficulty_check check (difficulty between 1 and 5),
  constraint questions_status_check check (status in ('draft', 'published', 'archived')),
  constraint questions_correct_option_label_check check (correct_option_label in ('A', 'B', 'C', 'D'))
);

create table if not exists public.question_options (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions(id) on delete cascade,
  label text not null,
  option_text text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (question_id, label),
  constraint question_options_label_check check (label in ('A', 'B', 'C', 'D'))
);

create table if not exists public.practice_sessions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  mode text not null default 'practice',
  exam_type text,
  subject_id uuid references public.subjects(id) on delete set null,
  topic_id uuid references public.topics(id) on delete set null,
  difficulty integer,
  total_questions integer not null default 0,
  correct_count integer not null default 0,
  incorrect_count integer not null default 0,
  accuracy numeric,
  total_time_seconds integer not null default 0,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint practice_sessions_mode_check check (mode in ('practice')),
  constraint practice_sessions_exam_type_check check (exam_type is null or exam_type in ('OC', 'Selective')),
  constraint practice_sessions_difficulty_check check (difficulty is null or difficulty between 1 and 5)
);

create table if not exists public.question_attempts (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references public.practice_sessions(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete cascade,
  selected_option_label text not null,
  correct_option_label text not null,
  is_correct boolean not null,
  time_taken_seconds integer not null default 0,
  mode text not null default 'practice',
  subject_id uuid references public.subjects(id) on delete set null,
  topic_id uuid references public.topics(id) on delete set null,
  question_type_id uuid references public.question_types(id) on delete set null,
  exam_type text,
  difficulty integer,
  attempted_at timestamptz not null default now(),
  constraint question_attempts_mode_check check (mode in ('practice')),
  constraint question_attempts_exam_type_check check (exam_type is null or exam_type in ('OC', 'Selective')),
  constraint question_attempts_difficulty_check check (difficulty is null or difficulty between 1 and 5),
  constraint question_attempts_selected_option_label_check check (selected_option_label in ('A', 'B', 'C', 'D')),
  constraint question_attempts_correct_option_label_check check (correct_option_label in ('A', 'B', 'C', 'D'))
);

create table if not exists public.student_mistake_questions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete cascade,
  subject_id uuid references public.subjects(id) on delete set null,
  topic_id uuid references public.topics(id) on delete set null,
  question_type_id uuid references public.question_types(id) on delete set null,
  exam_type text,
  difficulty integer,
  times_incorrect integer not null default 1,
  times_correct_after_mistake integer not null default 0,
  last_incorrect_at timestamptz not null default now(),
  last_attempted_at timestamptz not null default now(),
  status text not null default 'needs_review',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id, question_id),
  constraint student_mistake_questions_status_check check (status in ('needs_review', 'reviewing', 'improved', 'mastered')),
  constraint student_mistake_questions_exam_type_check check (exam_type is null or exam_type in ('OC', 'Selective')),
  constraint student_mistake_questions_difficulty_check check (difficulty is null or difficulty between 1 and 5),
  constraint student_mistake_questions_times_incorrect_check check (times_incorrect >= 0),
  constraint student_mistake_questions_times_correct_after_mistake_check check (times_correct_after_mistake >= 0)
);

create index if not exists idx_subjects_slug on public.subjects(slug);
create index if not exists idx_topics_subject_id on public.topics(subject_id);
create index if not exists idx_topics_slug on public.topics(slug);
create index if not exists idx_question_types_subject_id on public.question_types(subject_id);
create index if not exists idx_question_types_topic_id on public.question_types(topic_id);
create index if not exists idx_questions_subject_id on public.questions(subject_id);
create index if not exists idx_questions_topic_id on public.questions(topic_id);
create index if not exists idx_questions_question_type_id on public.questions(question_type_id);
create index if not exists idx_questions_exam_type on public.questions(exam_type);
create index if not exists idx_questions_difficulty on public.questions(difficulty);
create index if not exists idx_questions_status on public.questions(status);
create index if not exists idx_questions_created_at on public.questions(created_at desc);
create index if not exists idx_question_options_question_id on public.question_options(question_id);
create index if not exists idx_practice_sessions_student_id on public.practice_sessions(student_id);
create index if not exists idx_practice_sessions_created_at on public.practice_sessions(created_at desc);
create index if not exists idx_question_attempts_student_id on public.question_attempts(student_id);
create index if not exists idx_question_attempts_question_id on public.question_attempts(question_id);
create index if not exists idx_question_attempts_session_id on public.question_attempts(session_id);
create index if not exists idx_question_attempts_is_correct on public.question_attempts(is_correct);
create index if not exists idx_question_attempts_attempted_at on public.question_attempts(attempted_at desc);
create index if not exists idx_student_mistake_questions_student_id on public.student_mistake_questions(student_id);
create index if not exists idx_student_mistake_questions_question_id on public.student_mistake_questions(question_id);
create index if not exists idx_student_mistake_questions_status on public.student_mistake_questions(status);
create index if not exists idx_student_mistake_questions_last_incorrect_at on public.student_mistake_questions(last_incorrect_at desc);

drop trigger if exists subjects_set_updated_at on public.subjects;
create trigger subjects_set_updated_at
before update on public.subjects
for each row
execute function public.set_updated_at();

drop trigger if exists topics_set_updated_at on public.topics;
create trigger topics_set_updated_at
before update on public.topics
for each row
execute function public.set_updated_at();

drop trigger if exists question_types_set_updated_at on public.question_types;
create trigger question_types_set_updated_at
before update on public.question_types
for each row
execute function public.set_updated_at();

drop trigger if exists questions_set_updated_at on public.questions;
create trigger questions_set_updated_at
before update on public.questions
for each row
execute function public.set_updated_at();

drop trigger if exists student_mistake_questions_set_updated_at on public.student_mistake_questions;
create trigger student_mistake_questions_set_updated_at
before update on public.student_mistake_questions
for each row
execute function public.set_updated_at();

alter table public.subjects enable row level security;
alter table public.topics enable row level security;
alter table public.question_types enable row level security;
alter table public.questions enable row level security;
alter table public.question_options enable row level security;
alter table public.practice_sessions enable row level security;
alter table public.question_attempts enable row level security;
alter table public.student_mistake_questions enable row level security;

grant select, insert, update on public.subjects to authenticated;
grant select, insert, update on public.topics to authenticated;
grant select, insert, update on public.question_types to authenticated;
grant select, insert, update on public.questions to authenticated;
grant select, insert, update on public.question_options to authenticated;
grant select, insert, update on public.practice_sessions to authenticated;
grant select, insert, update on public.question_attempts to authenticated;
grant select, insert, update on public.student_mistake_questions to authenticated;

drop policy if exists "subjects_read_active_or_staff" on public.subjects;
create policy "subjects_read_active_or_staff"
on public.subjects
for select
to authenticated
using (
  is_active
  or public.get_current_user_role() in ('tutor', 'admin', 'super_admin')
);

drop policy if exists "subjects_admin_manage" on public.subjects;
create policy "subjects_admin_manage"
on public.subjects
for all
to authenticated
using (public.get_current_user_role() in ('admin', 'super_admin'))
with check (public.get_current_user_role() in ('admin', 'super_admin'));

drop policy if exists "topics_read_active_or_staff" on public.topics;
create policy "topics_read_active_or_staff"
on public.topics
for select
to authenticated
using (
  is_active
  or public.get_current_user_role() in ('tutor', 'admin', 'super_admin')
);

drop policy if exists "topics_admin_manage" on public.topics;
create policy "topics_admin_manage"
on public.topics
for all
to authenticated
using (public.get_current_user_role() in ('admin', 'super_admin'))
with check (public.get_current_user_role() in ('admin', 'super_admin'));

drop policy if exists "question_types_read_active_or_staff" on public.question_types;
create policy "question_types_read_active_or_staff"
on public.question_types
for select
to authenticated
using (
  is_active
  or public.get_current_user_role() in ('tutor', 'admin', 'super_admin')
);

drop policy if exists "question_types_admin_manage" on public.question_types;
create policy "question_types_admin_manage"
on public.question_types
for all
to authenticated
using (public.get_current_user_role() in ('admin', 'super_admin'))
with check (public.get_current_user_role() in ('admin', 'super_admin'));

drop policy if exists "questions_read_published_or_staff" on public.questions;
create policy "questions_read_published_or_staff"
on public.questions
for select
to authenticated
using (
  status = 'published'
  or public.get_current_user_role() in ('tutor', 'admin', 'super_admin')
);

drop policy if exists "questions_tutor_create" on public.questions;
create policy "questions_tutor_create"
on public.questions
for insert
to authenticated
with check (public.get_current_user_role() in ('tutor', 'admin', 'super_admin'));

drop policy if exists "questions_tutor_update" on public.questions;
create policy "questions_tutor_update"
on public.questions
for update
to authenticated
using (public.get_current_user_role() in ('tutor', 'admin', 'super_admin'))
with check (public.get_current_user_role() in ('tutor', 'admin', 'super_admin'));

drop policy if exists "question_options_read_published_or_staff" on public.question_options;
create policy "question_options_read_published_or_staff"
on public.question_options
for select
to authenticated
using (
  exists (
    select 1
    from public.questions question_record
    where question_record.id = question_options.question_id
      and (
        question_record.status = 'published'
        or public.get_current_user_role() in ('tutor', 'admin', 'super_admin')
      )
  )
);

drop policy if exists "question_options_tutor_create" on public.question_options;
create policy "question_options_tutor_create"
on public.question_options
for insert
to authenticated
with check (public.get_current_user_role() in ('tutor', 'admin', 'super_admin'));

drop policy if exists "question_options_tutor_update" on public.question_options;
create policy "question_options_tutor_update"
on public.question_options
for update
to authenticated
using (public.get_current_user_role() in ('tutor', 'admin', 'super_admin'))
with check (public.get_current_user_role() in ('tutor', 'admin', 'super_admin'));

drop policy if exists "practice_sessions_students_create_own" on public.practice_sessions;
create policy "practice_sessions_students_create_own"
on public.practice_sessions
for insert
to authenticated
with check (
  student_id = auth.uid()
  and public.get_current_user_role() in ('student', 'tutor', 'admin', 'super_admin')
);

drop policy if exists "practice_sessions_students_read_own_or_staff" on public.practice_sessions;
create policy "practice_sessions_students_read_own_or_staff"
on public.practice_sessions
for select
to authenticated
using (
  student_id = auth.uid()
  or public.get_current_user_role() in ('tutor', 'admin', 'super_admin')
);

drop policy if exists "practice_sessions_students_update_own_or_staff" on public.practice_sessions;
create policy "practice_sessions_students_update_own_or_staff"
on public.practice_sessions
for update
to authenticated
using (
  student_id = auth.uid()
  or public.get_current_user_role() in ('admin', 'super_admin')
)
with check (
  student_id = auth.uid()
  or public.get_current_user_role() in ('admin', 'super_admin')
);

drop policy if exists "question_attempts_students_create_own" on public.question_attempts;
create policy "question_attempts_students_create_own"
on public.question_attempts
for insert
to authenticated
with check (
  student_id = auth.uid()
  and public.get_current_user_role() in ('student', 'tutor', 'admin', 'super_admin')
);

drop policy if exists "question_attempts_students_read_own_or_staff" on public.question_attempts;
create policy "question_attempts_students_read_own_or_staff"
on public.question_attempts
for select
to authenticated
using (
  student_id = auth.uid()
  or public.get_current_user_role() in ('tutor', 'admin', 'super_admin')
);

drop policy if exists "student_mistake_questions_students_create_own" on public.student_mistake_questions;
create policy "student_mistake_questions_students_create_own"
on public.student_mistake_questions
for insert
to authenticated
with check (
  student_id = auth.uid()
  and public.get_current_user_role() in ('student', 'tutor', 'admin', 'super_admin')
);

drop policy if exists "student_mistake_questions_students_read_own_or_staff" on public.student_mistake_questions;
create policy "student_mistake_questions_students_read_own_or_staff"
on public.student_mistake_questions
for select
to authenticated
using (
  student_id = auth.uid()
  or public.get_current_user_role() in ('tutor', 'admin', 'super_admin')
);

drop policy if exists "student_mistake_questions_students_update_own_or_staff" on public.student_mistake_questions;
create policy "student_mistake_questions_students_update_own_or_staff"
on public.student_mistake_questions
for update
to authenticated
using (
  student_id = auth.uid()
  or public.get_current_user_role() in ('admin', 'super_admin')
)
with check (
  student_id = auth.uid()
  or public.get_current_user_role() in ('admin', 'super_admin')
);

insert into public.subjects (name, slug, description, sort_order)
values
  ('Mathematical Reasoning', 'mathematical-reasoning', 'Numeracy and quantitative reasoning practice.', 1),
  ('Thinking Skills', 'thinking-skills', 'Logic, deduction, argument and problem-solving practice.', 2),
  ('Reading', 'reading', 'Reading comprehension and text analysis practice.', 3),
  ('Writing', 'writing', 'Writing conventions and editing practice.', 4),
  ('Vocabulary', 'vocabulary', 'Word knowledge and language precision practice.', 5)
on conflict (slug) do update
set
  name = excluded.name,
  description = excluded.description,
  sort_order = excluded.sort_order,
  is_active = true;

with topic_seed(subject_slug, name, slug, description, sort_order) as (
  values
    ('mathematical-reasoning', 'Percentages', 'percentages', 'Percentage increases, decreases and comparisons.', 1),
    ('mathematical-reasoning', 'Fractions', 'fractions', 'Comparing and operating with fractions.', 2),
    ('mathematical-reasoning', 'Ratios', 'ratios', 'Reasoning with proportional relationships.', 3),
    ('mathematical-reasoning', 'Number Patterns', 'number-patterns', 'Finding rules in sequences.', 4),
    ('mathematical-reasoning', 'Geometry', 'geometry', 'Angles, area and shape reasoning.', 5),
    ('mathematical-reasoning', 'Data Interpretation', 'data-interpretation', 'Reading tables, charts and summaries.', 6),
    ('thinking-skills', 'Logical Deduction', 'logical-deduction', 'Using clues to narrow possibilities.', 1),
    ('thinking-skills', 'Pattern Recognition', 'pattern-recognition', 'Finding rules and structures in patterns.', 2),
    ('thinking-skills', 'Argument Reasoning', 'argument-reasoning', 'Evaluating claims and conclusions.', 3),
    ('thinking-skills', 'Assumptions', 'assumptions', 'Spotting what an argument takes for granted.', 4),
    ('thinking-skills', 'Strengthen and Weaken', 'strengthen-and-weaken', 'Choosing evidence that changes an argument.', 5),
    ('thinking-skills', 'Problem Solving', 'problem-solving', 'Reasoning through unfamiliar scenarios.', 6),
    ('reading', 'Main Idea', 'main-idea', 'Identifying the overall point of a text.', 1),
    ('reading', 'Inference', 'inference', 'Drawing conclusions from implied details.', 2),
    ('reading', 'Vocabulary in Context', 'vocabulary-in-context', 'Using surrounding clues to interpret words.', 3),
    ('reading', 'Author Purpose', 'author-purpose', 'Understanding why a text was written.', 4),
    ('reading', 'Detail Questions', 'detail-questions', 'Locating and interpreting precise details.', 5),
    ('writing', 'Grammar', 'grammar', 'Sentence correctness and standard usage.', 1),
    ('writing', 'Sentence Structure', 'sentence-structure', 'Combining and improving sentence flow.', 2),
    ('writing', 'Punctuation', 'punctuation', 'Using punctuation marks accurately.', 3),
    ('writing', 'Editing', 'editing', 'Improving clarity, accuracy and cohesion.', 4),
    ('writing', 'Written Expression', 'written-expression', 'Choosing the clearest and strongest wording.', 5),
    ('vocabulary', 'Synonyms', 'synonyms', 'Matching words with similar meanings.', 1),
    ('vocabulary', 'Antonyms', 'antonyms', 'Matching words with opposite meanings.', 2),
    ('vocabulary', 'Word Meaning', 'word-meaning', 'Understanding definitions and usage.', 3),
    ('vocabulary', 'Vocabulary in Context', 'vocabulary-in-context', 'Choosing the right meaning from context.', 4)
)
insert into public.topics (subject_id, name, slug, description, sort_order)
select subjects.id, topic_seed.name, topic_seed.slug, topic_seed.description, topic_seed.sort_order
from topic_seed
join public.subjects on subjects.slug = topic_seed.subject_slug
on conflict (subject_id, slug) do update
set
  name = excluded.name,
  description = excluded.description,
  sort_order = excluded.sort_order,
  is_active = true;

with type_seed(subject_slug, topic_slug, name, slug, description, sort_order) as (
  values
    ('mathematical-reasoning', 'percentages', 'Multi-step percentage problem', 'multi-step-percentage-problem', 'Problems involving percentage change and comparison.', 1),
    ('mathematical-reasoning', 'number-patterns', 'Number pattern', 'number-pattern', 'Identify and extend a number rule.', 2),
    ('mathematical-reasoning', 'fractions', 'Fraction comparison', 'fraction-comparison', 'Compare fractional values efficiently.', 3),
    ('thinking-skills', 'logical-deduction', 'Logical deduction', 'logical-deduction', 'Use clues to determine the only possible answer.', 4),
    ('thinking-skills', 'strengthen-and-weaken', 'Strengthen the argument', 'strengthen-the-argument', 'Find the statement that most strengthens an argument.', 5),
    ('thinking-skills', 'strengthen-and-weaken', 'Weaken the argument', 'weaken-the-argument', 'Find the statement that most weakens an argument.', 6),
    ('reading', 'inference', 'Inference question', 'inference-question', 'Answer a question that requires reading between the lines.', 7),
    ('reading', 'main-idea', 'Main idea question', 'main-idea-question', 'Identify the central message of a passage.', 8),
    ('reading', 'vocabulary-in-context', 'Vocabulary in context', 'vocabulary-in-context-question', 'Interpret a word using context clues.', 9),
    ('writing', 'grammar', 'Grammar correction', 'grammar-correction', 'Choose the sentence with correct grammar.', 10),
    ('writing', 'sentence-structure', 'Sentence structure', 'sentence-structure', 'Choose the clearest sentence construction.', 11),
    ('vocabulary', 'synonyms', 'Synonym question', 'synonym-question', 'Choose the closest meaning.', 12),
    ('vocabulary', 'antonyms', 'Antonym question', 'antonym-question', 'Choose the opposite meaning.', 13)
)
insert into public.question_types (subject_id, topic_id, name, slug, description, sort_order)
select subjects.id, topics.id, type_seed.name, type_seed.slug, type_seed.description, type_seed.sort_order
from type_seed
join public.subjects on subjects.slug = type_seed.subject_slug
left join public.topics on topics.subject_id = subjects.id and topics.slug = type_seed.topic_slug
on conflict (subject_id, slug) do update
set
  topic_id = excluded.topic_id,
  name = excluded.name,
  description = excluded.description,
  sort_order = excluded.sort_order,
  is_active = true;

with sample_questions (
  subject_slug,
  topic_slug,
  question_type_slug,
  exam_type,
  year_level,
  difficulty,
  question_text,
  passage_text,
  short_explanation,
  worked_solution,
  correct_option_label,
  status
) as (
  values
    ('mathematical-reasoning', 'percentages', 'multi-step-percentage-problem', 'Selective', 5, 3, 'A sports club raises its membership fee from $80 to $92. What is the percentage increase?', null, 'Work out the increase first, then compare it with the original fee.', 'The increase is $92 - $80 = $12. Divide the increase by the original fee: 12 / 80 = 0.15. Convert 0.15 to a percentage by multiplying by 100, so the increase is 15%.', 'B', 'published'),
    ('mathematical-reasoning', 'fractions', 'fraction-comparison', 'OC', 4, 2, 'Which fraction is greatest?', null, 'Convert the fractions to a common denominator or decimals.', 'Compare each fraction: 3/5 = 0.6, 5/8 = 0.625, 2/3 is about 0.667, and 7/12 is about 0.583. The greatest fraction is 2/3.', 'C', 'published'),
    ('mathematical-reasoning', 'number-patterns', 'number-pattern', 'Selective', 5, 3, 'What is the next number in the pattern 4, 7, 13, 22, 34, ...?', null, 'Look at how much is being added each time.', 'The differences are +3, +6, +9, +12. The next difference should be +15. So 34 + 15 = 49.', 'D', 'published'),
    ('thinking-skills', 'logical-deduction', 'logical-deduction', 'Selective', 6, 4, 'Three students - Ava, Ben and Chloe - each present on a different day: Monday, Tuesday or Wednesday. Ava is not on Monday. Ben is after Chloe. Chloe is not on Wednesday. Which day is Ben presenting?', null, 'Place the fixed clue first, then test the remaining order.', 'Chloe cannot be Wednesday, and Ben must be after Chloe, so Chloe cannot be Tuesday either because then Ben would need Wednesday and Ava would need Monday, which Ava cannot do. Therefore Chloe is Monday, Ava is Tuesday, and Ben is Wednesday.', 'D', 'published'),
    ('thinking-skills', 'strengthen-and-weaken', 'strengthen-the-argument', 'Selective', 6, 4, 'A principal argues that extending lunch by ten minutes will improve concentration in afternoon lessons. Which statement best strengthens the argument?', null, 'Choose the option that most directly links more lunchtime to better learning after lunch.', 'The strongest support is evidence that students in a trial class became more attentive after having a longer lunch break. That directly supports the principal''s claim about concentration.', 'A', 'published'),
    ('thinking-skills', 'strengthen-and-weaken', 'weaken-the-argument', 'Selective', 6, 4, 'A local council claims that planting more trees along a street will reduce traffic noise for nearby homes. Which statement best weakens the claim?', null, 'Look for information showing the trees are unlikely to affect the noise level.', 'The best weakening statement is that the loudest noise comes from trucks using the street at night and the proposed trees would be small shrubs for several years. That makes the plan unlikely to reduce the main source of noise soon.', 'C', 'published'),
    ('reading', 'main-idea', 'main-idea-question', 'OC', 4, 2, 'What is the main idea of the passage?', 'Mina kept a notebook beside her bed. Each evening she wrote down one question she had wondered about during the day. On Saturdays, she took the notebook to the library and tried to answer two of the questions. Over time, the notebook became full of facts, sketches and half-finished ideas. Mina said it was not a record of what she knew, but a map of what she wanted to learn next.', 'Focus on the overall message, not one small detail.', 'The passage is mainly about Mina using her curiosity notebook to guide her learning. The notebook helps her collect questions and explore them, so the main idea is that curiosity can shape ongoing learning.', 'B', 'published'),
    ('reading', 'inference', 'inference-question', 'Selective', 5, 3, 'What can the reader infer about the coach?', 'Before practice, Coach Lee moved the cones closer together and shortened the passing drill. "Today we work on speed first," she said, watching the dark clouds gather above the oval. Ten minutes later, rain swept across the field and the team jogged inside without missing the main part of training.', 'Think about what the coach''s actions suggest, not just what is stated directly.', 'The coach likely noticed the weather change and adjusted practice early so the team could finish the most important skill work before the rain arrived. This shows she is prepared and quick to adapt.', 'A', 'published'),
    ('reading', 'vocabulary-in-context', 'vocabulary-in-context-question', 'OC', 4, 2, 'In the sentence "The lantern gave off a faint glow," what does faint most nearly mean?', 'The campers woke before sunrise. Outside the tent, the lantern gave off a faint glow, just enough to show the path to the cooking shelter.', 'Use nearby clues about the amount of light.', 'The passage says the lantern gave "just enough" light to show the path, so faint means weak or not very bright.', 'B', 'published'),
    ('writing', 'grammar', 'grammar-correction', 'Selective', 5, 3, 'Which sentence is grammatically correct?', null, 'Look for correct subject-verb agreement and punctuation.', 'The correct sentence is the one where the singular subject matches the singular verb and the introductory phrase is punctuated correctly. "After the storm, the garden was full of broken branches" is grammatically correct.', 'A', 'published'),
    ('writing', 'sentence-structure', 'sentence-structure', 'OC', 4, 2, 'Which option is the clearest sentence?', null, 'Choose the version that says the same idea most directly and smoothly.', 'The clearest sentence removes repetition and places related ideas together. "Lena packed her bag quickly because the bus was already arriving" is the strongest option.', 'D', 'published'),
    ('vocabulary', 'synonyms', 'synonym-question', 'OC', 4, 2, 'Which word is closest in meaning to cautious?', null, 'Look for a word that means careful or avoiding risk.', 'Cautious means careful and mindful of danger. The closest synonym is careful.', 'B', 'published'),
    ('vocabulary', 'antonyms', 'antonym-question', 'Selective', 5, 2, 'Which word is the opposite of scarce?', null, 'Find the choice that means plentiful or easy to find.', 'Scarce means in short supply. The opposite is abundant, which means plentiful.', 'C', 'published')
),
inserted_questions as (
  insert into public.questions (
    subject_id,
    topic_id,
    question_type_id,
    exam_type,
    year_level,
    difficulty,
    question_text,
    passage_text,
    short_explanation,
    worked_solution,
    correct_option_label,
    status,
    published_at
  )
  select
    subjects.id,
    topics.id,
    question_types.id,
    sample_questions.exam_type,
    sample_questions.year_level,
    sample_questions.difficulty,
    sample_questions.question_text,
    sample_questions.passage_text,
    sample_questions.short_explanation,
    sample_questions.worked_solution,
    sample_questions.correct_option_label,
    sample_questions.status,
    case when sample_questions.status = 'published' then now() else null end
  from sample_questions
  join public.subjects on subjects.slug = sample_questions.subject_slug
  join public.topics on topics.subject_id = subjects.id and topics.slug = sample_questions.topic_slug
  left join public.question_types on question_types.subject_id = subjects.id and question_types.slug = sample_questions.question_type_slug
  where not exists (
    select 1
    from public.questions existing_questions
    where existing_questions.question_text = sample_questions.question_text
  )
  returning id, question_text
)
insert into public.question_options (question_id, label, option_text, sort_order)
select inserted_questions.id, option_seed.label, option_seed.option_text, option_seed.sort_order
from inserted_questions
join (
  values
    ('A sports club raises its membership fee from $80 to $92. What is the percentage increase?', 'A', '10%', 1),
    ('A sports club raises its membership fee from $80 to $92. What is the percentage increase?', 'B', '15%', 2),
    ('A sports club raises its membership fee from $80 to $92. What is the percentage increase?', 'C', '12%', 3),
    ('A sports club raises its membership fee from $80 to $92. What is the percentage increase?', 'D', '18%', 4),
    ('Which fraction is greatest?', 'A', '3/5', 1),
    ('Which fraction is greatest?', 'B', '5/8', 2),
    ('Which fraction is greatest?', 'C', '2/3', 3),
    ('Which fraction is greatest?', 'D', '7/12', 4),
    ('What is the next number in the pattern 4, 7, 13, 22, 34, ...?', 'A', '43', 1),
    ('What is the next number in the pattern 4, 7, 13, 22, 34, ...?', 'B', '46', 2),
    ('What is the next number in the pattern 4, 7, 13, 22, 34, ...?', 'C', '47', 3),
    ('What is the next number in the pattern 4, 7, 13, 22, 34, ...?', 'D', '49', 4),
    ('Three students - Ava, Ben and Chloe - each present on a different day: Monday, Tuesday or Wednesday. Ava is not on Monday. Ben is after Chloe. Chloe is not on Wednesday. Which day is Ben presenting?', 'A', 'Monday', 1),
    ('Three students - Ava, Ben and Chloe - each present on a different day: Monday, Tuesday or Wednesday. Ava is not on Monday. Ben is after Chloe. Chloe is not on Wednesday. Which day is Ben presenting?', 'B', 'Tuesday', 2),
    ('Three students - Ava, Ben and Chloe - each present on a different day: Monday, Tuesday or Wednesday. Ava is not on Monday. Ben is after Chloe. Chloe is not on Wednesday. Which day is Ben presenting?', 'C', 'Monday or Tuesday', 3),
    ('Three students - Ava, Ben and Chloe - each present on a different day: Monday, Tuesday or Wednesday. Ava is not on Monday. Ben is after Chloe. Chloe is not on Wednesday. Which day is Ben presenting?', 'D', 'Wednesday', 4),
    ('A principal argues that extending lunch by ten minutes will improve concentration in afternoon lessons. Which statement best strengthens the argument?', 'A', 'A trial class with a longer lunch settled more quickly and stayed focused for more of the afternoon lesson.', 1),
    ('A principal argues that extending lunch by ten minutes will improve concentration in afternoon lessons. Which statement best strengthens the argument?', 'B', 'Many students prefer outdoor games at lunchtime.', 2),
    ('A principal argues that extending lunch by ten minutes will improve concentration in afternoon lessons. Which statement best strengthens the argument?', 'C', 'Teachers already plan short breaks during long lessons.', 3),
    ('A principal argues that extending lunch by ten minutes will improve concentration in afternoon lessons. Which statement best strengthens the argument?', 'D', 'The school canteen sometimes runs out of sandwiches.', 4),
    ('A local council claims that planting more trees along a street will reduce traffic noise for nearby homes. Which statement best weakens the claim?', 'A', 'Residents would like the street to look greener.', 1),
    ('A local council claims that planting more trees along a street will reduce traffic noise for nearby homes. Which statement best weakens the claim?', 'B', 'Tree roots can improve soil stability.', 2),
    ('A local council claims that planting more trees along a street will reduce traffic noise for nearby homes. Which statement best weakens the claim?', 'C', 'The loudest noise comes from heavy trucks and the proposed plants will stay low for several years.', 3),
    ('A local council claims that planting more trees along a street will reduce traffic noise for nearby homes. Which statement best weakens the claim?', 'D', 'Some residents enjoy hearing traffic because it reminds them of the city.', 4),
    ('What is the main idea of the passage?', 'A', 'Mina prefers libraries to classrooms.', 1),
    ('What is the main idea of the passage?', 'B', 'Mina uses a notebook of questions to guide what she learns.', 2),
    ('What is the main idea of the passage?', 'C', 'Mina enjoys sketching facts on Saturdays.', 3),
    ('What is the main idea of the passage?', 'D', 'Mina already knows many interesting facts.', 4),
    ('What can the reader infer about the coach?', 'A', 'She adapts plans quickly when conditions change.', 1),
    ('What can the reader infer about the coach?', 'B', 'She dislikes training outdoors.', 2),
    ('What can the reader infer about the coach?', 'C', 'She always cancels practice early.', 3),
    ('What can the reader infer about the coach?', 'D', 'She prefers indoor sports to football.', 4),
    ('In the sentence "The lantern gave off a faint glow," what does faint most nearly mean?', 'A', 'golden', 1),
    ('In the sentence "The lantern gave off a faint glow," what does faint most nearly mean?', 'B', 'weak', 2),
    ('In the sentence "The lantern gave off a faint glow," what does faint most nearly mean?', 'C', 'surprising', 3),
    ('In the sentence "The lantern gave off a faint glow," what does faint most nearly mean?', 'D', 'dangerous', 4),
    ('Which sentence is grammatically correct?', 'A', 'After the storm, the garden was full of broken branches.', 1),
    ('Which sentence is grammatically correct?', 'B', 'After the storm the garden were full of broken branches.', 2),
    ('Which sentence is grammatically correct?', 'C', 'After the storm, the garden were full, of broken branches.', 3),
    ('Which sentence is grammatically correct?', 'D', 'After the storm the garden was full of broken branch.', 4),
    ('Which option is the clearest sentence?', 'A', 'Because the bus arriving, Lena packed with quickness her bag.', 1),
    ('Which option is the clearest sentence?', 'B', 'Lena, because the bus was arriving, packed quickly, her bag.', 2),
    ('Which option is the clearest sentence?', 'C', 'The bus was arriving and Lena packed her bag in a quick way.', 3),
    ('Which option is the clearest sentence?', 'D', 'Lena packed her bag quickly because the bus was already arriving.', 4),
    ('Which word is closest in meaning to cautious?', 'A', 'restless', 1),
    ('Which word is closest in meaning to cautious?', 'B', 'careful', 2),
    ('Which word is closest in meaning to cautious?', 'C', 'cheerful', 3),
    ('Which word is closest in meaning to cautious?', 'D', 'quick', 4),
    ('Which word is the opposite of scarce?', 'A', 'uncertain', 1),
    ('Which word is the opposite of scarce?', 'B', 'hidden', 2),
    ('Which word is the opposite of scarce?', 'C', 'abundant', 3),
    ('Which word is the opposite of scarce?', 'D', 'fragile', 4)
) as option_seed(question_text, label, option_text, sort_order)
  on option_seed.question_text = inserted_questions.question_text
where not exists (
  select 1
  from public.question_options existing_options
  where existing_options.question_id = inserted_questions.id
);
