# Import Notes

## Files

- `reading-100.csv`: 100 original Reading multiple-choice rows (4 options), grouped into 10 shared `stimulus_id` sets (narrative, poem, cloze, paired extracts, information text, notice).
- `mathematical-reasoning-100.csv`: 68 original Mathematical Reasoning multiple-choice rows (5 options).
- `thinking-skills-100.csv`: 60 original Thinking Skills multiple-choice rows (4 options).
- `writing-prompts.csv`: 20 original extended-response writing tasks with rubric JSON.

Total: **248 rows**, all `status = draft`, all `exam_type = Selective`, `year_level = 6`.

## Schema Adaptations

- The files use the repo's exact 45-column v2 import header from `docs/question-import-template-v2.csv`.
- The prompt's `question_type` field maps to the repo's `essential_question_type`; the v2 template has no separate `question_type` column.
- Difficulty is stored as integers `1`–`5` (matching the DB/importer), not labels.
- Year level is `6` to match importer validation; content targets strong Year 5–6 students.
- Tags are comma-separated because `parseTags` in `src/lib/questions/mutations.ts` splits on commas.
- `essential_question_type` values use the canonical names from `docs/question-taxonomy-v1.csv` so they map onto the platform taxonomy (rather than auto-creating off-taxonomy nodes).

## Quality Assurance Applied

- **Format:** every file validated against the importer's rules (`src/lib/import/validation.ts`, `option-rules.ts`, `rubric.ts`) — 0 errors, 0 warnings, correct option counts per subject (Reading/Thinking 4 options, Maths 5), rubrics present on every writing row with criteria summing to marks.
- **No duplicates:** the earlier `-002/-003` placeholder rows that repeated a `-001` stem verbatim (52 in Maths, 48 in Thinking Skills) were removed; the Maths/Thinking files were rebuilt from a fresh, systematically-varied set. Cross-file duplicate detection (external_id and normalised question text) is clean.
- **Full variation coverage:** every essential_question_type in `docs/question-taxonomy-v1.csv` is covered — Reading 22/22, Mathematical Reasoning 34/34, Thinking Skills 30/30, Writing 12/12.
- **Answer keys independently verified:** every multiple-choice item was re-solved from scratch by a second pass (blind to the key). One mis-key was found and fixed during this process; all others confirmed correct.
- **Answer-position balance:** `reading-100.csv` originally had all 100 correct answers in position A; option order was shuffled (correct-option text preserved, key and per-option explanations remapped) to a balanced spread (A29/B24/C17/D30). Order-sensitive items (e.g. "Extract A / B / Both / Neither") were left untouched.

## Recommended Import Settings

1. Sign in as an admin, tutor or super admin.
2. Open `/admin/import`.
3. Upload one CSV at a time.
4. Keep import status as `draft`.
5. Leave `Missing topics` and `Missing question types` as `Create automatically` for any new variants.
6. Preview first, review warnings, then import.
7. Do not publish rows with pending assets until the asset placeholders have been replaced.

## Pending Image Assets

Some questions reference `asset://pending/...` placeholders for diagrams/charts (spatial reasoning, geometry, graphs). They import and are reviewable in draft form (the placeholder shows the alt text), but produce and attach the real images before publishing:

- `mathematical-reasoning-100.csv`: 9 rows need images.
- `thinking-skills-100.csv`: 10 rows need images.
- `reading-100.csv`, `writing-prompts.csv`: none.

## Manual Review Warnings

- All content is original but should be reviewed by a human before publication.
- Writing rubrics are generic 20-mark rubrics; adjust if Minerva uses a more specific marking scale.
- No Supabase migrations or production imports were run.

## Counts

- Reading: 100
- Mathematical Reasoning: 68
- Thinking Skills: 60
- Writing: 20
- **Total: 248**
