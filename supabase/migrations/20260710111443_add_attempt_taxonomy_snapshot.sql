-- Canonical taxonomy snapshot on question_attempts — powers Subtopic Mastery.
--
-- Why denormalise instead of joining questions at read time:
--  * Students may only SELECT published questions under RLS, so an attempt on a
--    question that was later archived would silently lose its taxonomy. Mastery
--    must keep counting evidence the student actually produced.
--  * Mastery reads scan a student's whole attempt history per subtopic; joining
--    the questions table on every read is needlessly expensive.
--
-- Raw attempt history is untouched: this only ADDS nullable columns and fills
-- them from the question the attempt already points at. No rows are deleted,
-- merged or aggregated away.
--
-- Values are canonical codes from src/lib/taxonomy (the single source of truth).
-- Like questions.domain_code/subtopic_code they are nullable text with no CHECK
-- constraint, because taxonomy codes are validated in the application layer.

-- 1) Columns -----------------------------------------------------------------

alter table public.question_attempts add column if not exists domain_code text;
alter table public.question_attempts add column if not exists subtopic_code text;
alter table public.question_attempts add column if not exists skill_code text;
alter table public.question_attempts add column if not exists pattern_key text;

comment on column public.question_attempts.domain_code is 'Canonical domain code, snapshotted from questions at attempt time.';
comment on column public.question_attempts.subtopic_code is 'Canonical subtopic code, snapshotted from questions at attempt time. Drives Subtopic Mastery.';
comment on column public.question_attempts.skill_code is 'Canonical skill code, snapshotted from questions at attempt time.';
comment on column public.question_attempts.pattern_key is 'Pattern key, snapshotted from questions at attempt time. Internal evidence-diversity signal; never shown to students.';

-- 2) Keep the snapshot filled on insert -------------------------------------
-- SECURITY DEFINER: a student inserting an attempt cannot SELECT a question that
-- is not published, but the snapshot must still be written. The function only
-- reads taxonomy codes for the question the attempt already references.

create or replace function public.set_question_attempt_taxonomy()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.domain_code is null
     or new.subtopic_code is null
     or new.skill_code is null
     or new.pattern_key is null then
    select
      coalesce(new.domain_code, q.domain_code),
      coalesce(new.subtopic_code, q.subtopic_code),
      coalesce(new.skill_code, q.skill_code),
      coalesce(new.pattern_key, q.pattern_key)
    into new.domain_code, new.subtopic_code, new.skill_code, new.pattern_key
    from public.questions q
    where q.id = new.question_id;
  end if;

  return new;
end;
$$;

comment on function public.set_question_attempt_taxonomy() is
  'Snapshots the canonical taxonomy codes of the attempted question onto the attempt row.';

drop trigger if exists set_question_attempt_taxonomy on public.question_attempts;
create trigger set_question_attempt_taxonomy
before insert on public.question_attempts
for each row
execute function public.set_question_attempt_taxonomy();

-- 3) Backfill existing attempts ---------------------------------------------
-- Legacy attempts whose question has no canonical placement stay NULL; the app
-- surfaces them as "legacy attempts" rather than guessing a subtopic.

update public.question_attempts a
set domain_code   = q.domain_code,
    subtopic_code = q.subtopic_code,
    skill_code    = q.skill_code,
    pattern_key   = q.pattern_key
from public.questions q
where q.id = a.question_id
  and a.domain_code is null
  and a.subtopic_code is null
  and a.skill_code is null
  and a.pattern_key is null;

-- 4) Indexes -----------------------------------------------------------------
-- Student mastery reads: "all of one student's attempts in one subtopic, newest first".
create index if not exists idx_question_attempts_student_subtopic
  on public.question_attempts(student_id, subtopic_code, attempted_at desc)
  where subtopic_code is not null;

-- Admin analytics reads: "all attempts in one subtopic across students".
create index if not exists idx_question_attempts_subtopic
  on public.question_attempts(subtopic_code)
  where subtopic_code is not null;
