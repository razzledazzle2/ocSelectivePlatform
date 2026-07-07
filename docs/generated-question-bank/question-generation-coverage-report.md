# Question Generation — Coverage Report

Bank in this folder, aligned to `docs/question-taxonomy-v1.csv` and modelled on the style of the NSW Selective High School Placement Test practice papers (original content only — no past-paper text copied or paraphrased).

## Summary

| Subject | Rows | Essential-question-type coverage |
|---|---|---|
| Reading | 100 | **22 / 22** |
| Mathematical Reasoning | 68 | **34 / 34** |
| Thinking Skills | 60 | **30 / 30** |
| Writing | 20 | **12 / 12** |
| **Total** | **248** | **98 / 98 taxonomy types covered** |

Every `essential_question_type` in `docs/question-taxonomy-v1.csv` appears at least once. All rows: `exam_type = Selective`, `year_level = 6`, `status = draft`.

## What each subject covers

- **Reading (10 stimulus sets):** literal comprehension, inference (feeling / motive / cause / setting), main idea, theme, vocabulary in context, tone & attitude, language-feature effect, text structure, author purpose, character motivation & change, narrative perspective, sequencing (with a flashback trap), evidence matching, poetry (imagery / tone / symbolism), paired-extract comparison, information-text interpretation with cohesion items, and both vocabulary and grammar cloze.
- **Mathematical Reasoning:** number (arithmetic, place value, factors/multiples, remainders), fractions/decimals/percentages (incl. reverse percentage), ratio & rates, time & timetables, money, unit conversion & length, area/perimeter (incl. composite shapes), volume, angles, symmetry, transformations, coordinates, patterns & pre-algebra, data tables, column/line/pie graphs, averages, probability, systematic counting, working backwards, and multi-step word problems. Statement-combination items ("statements 1, 2 and 3") are included.
- **Thinking Skills:** argument analysis (conclusion, reason, strengthen, weaken, assumption, flaw incl. the "Whose reasoning is correct?" two-speaker format), evidence & reasoning (evaluate evidence, cause vs correlation, drawing conclusions), deduction (must/cannot be true, conditional logic, syllogisms), ordering & sets (ordering, ranking, set logic, Venn counting), truth-teller puzzles, numerical reasoning (pattern recognition, rule deduction, optimisation, table reasoning, data sufficiency), and abstract/spatial (sequences, matrices, analogies, code/symbol, rotation/reflection, paper folding, 3D views, assembly).
- **Writing:** narrative (given opening/ending line, title, twist), description, diary, recount, persuasive, discursive, speech, letter, informative, newspaper report, advice sheet, and hybrid stimulus response — each with a full 20-mark `rubric_json` (criteria, score bands, planning hints).

## Quality assurance

- **Format:** validated against the importer's own rules (`src/lib/import/validation.ts`, `option-rules.ts`, `rubric.ts`) — 0 errors, 0 warnings across all four files.
- **No duplicates:** placeholder rows that repeated a stem verbatim were removed (52 in Maths, 48 in Thinking Skills); Maths and Thinking Skills were rebuilt from a systematically-varied, deduplicated set. External-id and normalised-text duplicate checks are clean within and across files.
- **Answer keys verified:** every multiple-choice item was independently re-solved blind to the key; one mis-key was found and corrected, the rest confirmed.
- **Answer-position balance:** `reading-100.csv` (originally all correct answers in position A) was rebalanced to A29/B24/C17/D30 without changing any answer, skipping order-sensitive items.

## Known follow-ups

- 19 rows reference `asset://pending/...` images (9 Maths, 10 Thinking Skills) — produce and attach diagrams before publishing those rows.
- Maths (68) and Thinking Skills (60) are below 100 rows because the duplicate placeholders were removed rather than replaced one-for-one; the set still covers every taxonomy type. Generating more items per type to reach 100 each is a straightforward next step if desired.
- All rows are `draft`; a human should review before publishing.
