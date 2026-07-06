-- Seed the student-facing Skill Library categories as topics.
--
-- Categories per subject (product spec):
--   Reading:                Cloze Passage, Extracts, Narrative, Poetry
--   Mathematical Reasoning: Area, Perimeter, Time, Algebra, Arithmetic Operations,
--                           Decimals, Fractions, Percentages, Probability
--   Thinking Skills:        Drawing Conclusions, Arguments, Logic,
--                           Mathematical Analysis, Abstract Reasoning
--   Writing:                no categories for now
--
-- Existing topics (and the questions attached to them) are preserved; topics that
-- are not part of the category list are pushed to a later sort_order so the new
-- categories lead each subject. Upserts key on (subject_id, slug).

with category_seed(subject_slug, name, slug, description, sort_order) as (
  values
    -- Reading
    ('reading', 'Cloze Passage', 'cloze-passage', 'Fill the gaps in a passage using context and grammar clues.', 1),
    ('reading', 'Extracts', 'extracts', 'Comprehension of short fiction and non-fiction extracts.', 2),
    ('reading', 'Narrative', 'narrative', 'Understanding characters, plot and narrative technique.', 3),
    ('reading', 'Poetry', 'poetry', 'Interpreting imagery, tone and meaning in poems.', 4),

    -- Mathematical Reasoning
    ('mathematical-reasoning', 'Area', 'area', 'Area of shapes and composite figures.', 1),
    ('mathematical-reasoning', 'Perimeter', 'perimeter', 'Perimeter and boundary length problems.', 2),
    ('mathematical-reasoning', 'Time', 'time', 'Clocks, timetables, elapsed time and rates.', 3),
    ('mathematical-reasoning', 'Algebra', 'algebra', 'Patterns, unknowns and simple equations.', 4),
    ('mathematical-reasoning', 'Arithmetic Operations', 'arithmetic-operations', 'Whole-number operations and order of operations.', 5),
    ('mathematical-reasoning', 'Decimals', 'decimals', 'Decimal place value, operations and comparisons.', 6),
    ('mathematical-reasoning', 'Fractions', 'fractions', 'Comparing and operating with fractions.', 7),
    ('mathematical-reasoning', 'Percentages', 'percentages', 'Percentage increases, decreases and comparisons.', 8),
    ('mathematical-reasoning', 'Probability', 'probability', 'Chance, outcomes and simple probability.', 9),

    -- Thinking Skills
    ('thinking-skills', 'Drawing Conclusions', 'drawing-conclusions', 'Choosing the conclusion best supported by the information.', 1),
    ('thinking-skills', 'Arguments', 'arguments', 'Evaluating, strengthening and weakening arguments.', 2),
    ('thinking-skills', 'Logic', 'logic', 'Deduction puzzles and logical reasoning.', 3),
    ('thinking-skills', 'Mathematical Analysis', 'mathematical-analysis', 'Quantitative reasoning inside thinking-skills problems.', 4),
    ('thinking-skills', 'Abstract Reasoning', 'abstract-reasoning', 'Patterns, sequences and spatial reasoning.', 5)
)
insert into public.topics (subject_id, name, slug, description, sort_order)
select subjects.id, category_seed.name, category_seed.slug, category_seed.description, category_seed.sort_order
from category_seed
join public.subjects on subjects.slug = category_seed.subject_slug
on conflict (subject_id, slug) do update
set
  name = excluded.name,
  description = excluded.description,
  sort_order = excluded.sort_order,
  is_active = true;

-- Push pre-existing, non-category topics behind the seeded categories so the
-- Skill Library lists the official categories first. They stay active because
-- existing questions still reference them.
update public.topics as t
set sort_order = t.sort_order + 100
from public.subjects as s
where t.subject_id = s.id
  and s.slug in ('reading', 'mathematical-reasoning', 'thinking-skills')
  and t.sort_order < 100
  and t.slug not in (
    'cloze-passage', 'extracts', 'narrative', 'poetry',
    'area', 'perimeter', 'time', 'algebra', 'arithmetic-operations',
    'decimals', 'fractions', 'percentages', 'probability',
    'drawing-conclusions', 'arguments', 'logic', 'mathematical-analysis', 'abstract-reasoning'
  );
