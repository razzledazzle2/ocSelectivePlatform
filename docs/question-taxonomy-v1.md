# Question Taxonomy v1

The canonical taxonomy used across the question bank, CSV import/export, admin
filters, question coverage, mock-test construction, student subtopic mastery and
analytics.

**Single source of truth:** [`src/lib/taxonomy/canonical-taxonomy.ts`](../src/lib/taxonomy/canonical-taxonomy.ts)
(re-exported from `@/lib/taxonomy`). Do **not** scatter taxonomy string literals
through components — import from here.

---

## 1. Model

The learning hierarchy is four levels:

```
Subject → Domain → Subtopic → Skill
```

Kept **separate** from the hierarchy are these metadata dimensions (a question
carries one of each where relevant — they are not learning subtopics):

| Dimension | Meaning | Codes source |
|---|---|---|
| Question family | Structural shape of the task | `QUESTION_FAMILIES` |
| Stimulus type | What stimulus the question carries | `STIMULUS_FORMATS` |
| Stimulus genre | Text type of a Reading stimulus | `STIMULUS_GENRES` |
| Response format | `single_choice` / `extended_response` | `ANSWER_FORMATS` (reused) |
| Difficulty | 1–5 | `questions.difficulty` (reused) |
| Pattern key | Free-form key grouping near-identical templates | free text |
| Tags | Zero or more secondary labels | `questions.tags` (reused) |
| Asset render method | How an asset is produced/rendered | `ASSET_RENDER_METHODS` |
| Writing form / purpose / prompt stimulus | Admin-only Writing metadata | `WRITING_FORMS` / `WRITING_PURPOSES` / `WRITING_PROMPT_STIMULI` |

Each question has **one** primary subject, domain, subtopic, and skill (where
appropriate), one pattern key, and zero or more secondary tags.

### Why stimulus types and genres are not subtopics

A subtopic answers **“what is the student learning?”** A stimulus type answers
**“what does the question show?”** and a genre answers **“what kind of text is
it?”**. The same subtopic (`main_idea_and_theme`) can appear over a narrative, an
informative text, or a poem; the same stimulus type (a bar chart) can serve
`charts_and_graphs` in Maths and `charts_and_graph_reasoning` in Thinking Skills.
Folding format/genre/image-type into subtopics would (a) fragment mastery data,
(b) make coverage and mock construction lie about what a student has practised,
and (c) explode the subtopic list combinatorially. So `Narrative` is stored as a
**stimulus genre**, never as a Reading subtopic.

---

## 2. Stable codes

Every subject, domain and subtopic (and each defined skill) has:

- a **stable machine-readable `code`** (snake_case, `^[a-z0-9_]+$`),
- a human-readable **`label`**,
- a **parent** relationship (`subjectCode` / `domainCode` / `subtopicCode`),
- a **`sortOrder`**,
- **`studentVisible`** and **`adminVisible`** flags.

Persist the **code**, never the label. Labels may be re-worded; codes are frozen.
Codes are globally unique across the whole hierarchy (enforced by a unit test).

Example (matches the spec):

```
mathematical_reasoning   (subject)
  └─ number_algebra      (domain)
       └─ fractions      (subtopic)
```

The DB columns holding these are **nullable text** on `public.questions`
(migration `20260710022946_add_canonical_taxonomy_fields.sql`) — **no Postgres
enums / CHECK constraints**, so the taxonomy stays editable. Valid values are
enforced in the app against this module.

| Column | Dimension |
|---|---|
| `subject_id` (existing FK) | Subject |
| `domain_code` | Domain |
| `subtopic_code` | Subtopic |
| `skill_code` | Skill (primary) |
| `pattern_key` | Pattern key |
| `question_family` | Question family |
| `stimulus_format` | Stimulus type |
| `stimulus_genre` | Stimulus genre |
| `asset_render_method` | Asset render method |
| `writing_form` / `writing_purpose` / `writing_prompt_stimulus` | Writing (admin) |
| `difficulty`, `answer_format`, `tags`, `skill_tags` (existing) | reused |

---

## 3. Complete hierarchy

### Reading  *(student + admin visible)*

- **Comprehension and Comparison** (`comprehension_comparison`)
  Single extract comprehension · Paired extract comparison · Multiple extract
  matching · Main idea and theme · Character, setting and events · Author purpose
  and audience · Tone, attitude and viewpoint · Language techniques · Inference
  and drawing conclusions · Vocabulary in context · Evidence and information
  retrieval
- **Cloze and Language** (`cloze_language`)
  Vocabulary and precise word choice · Grammar and usage · Connectives and
  cohesion · Collocations and common expressions · Meaning from context
- **Poetry** (`poetry`)
  Meaning and theme · Imagery and figurative language · Tone and mood · Speaker
  and perspective · Structure and form · Sound and rhythm
- **Text Structure and Cohesion** (`text_structure_cohesion`)
  Sentence insertion · Paragraph heading matching · Paragraph summarisation ·
  Sequencing and organisation · Cohesion across a text

Reading **stimulus genres**: narrative fiction · memoir or autobiography ·
informative text · persuasive or opinion text · article or report · poetry ·
mixed extracts.

### Mathematical Reasoning  *(student + admin visible)*

- **Number and Algebra** (`number_algebra`)
  Arithmetic and number reasoning · Place value and rounding · Factors, multiples
  and divisibility · Fractions · Decimals · Percentages · Ratio, rates and
  proportion · Algebra and unknowns · Patterns and sequences · Counting and
  combinations
- **Measurement and Financial Mathematics** (`measurement_financial`)
  Length, mass and capacity · Time and timetables · Money and financial
  mathematics · **Area and perimeter** · Volume and capacity · Unit conversion
- **Geometry and Spatial Reasoning** (`geometry_spatial`)
  2D shapes and properties · Angles · Symmetry and transformations · Coordinates
  and direction · 3D shapes, nets and views
- **Data and Probability** (`data_probability`)
  Tables and data interpretation · Charts and graphs · Statistics and averages ·
  Probability

**Area and perimeter is a single subtopic.** The finer concepts are **skills**:
Rectangle area · Composite area · Missing side length · Basic perimeter ·
Composite perimeter · Comparing area and perimeter · Area with algebra ·
Perimeter with algebra.

### Thinking Skills  *(student + admin visible)*

- **Arguments and Evidence** (`arguments_evidence`)
  Identifying conclusions and claims · Identifying assumptions · Strengthening
  arguments · Weakening arguments · Identifying flaws · Cause and effect ·
  Correlation and causation · Evaluating evidence · Experiments and fair testing ·
  Sampling and bias
- **Logic and Deduction** (`logic_deduction`)
  **Drawing conclusions** · Conditional logic · Necessary and sufficient
  conditions · Ordering and ranking · Sequencing · Scheduling and timetables ·
  Logic grids and matching constraints · Set and Venn logic · Truth and lies ·
  Information sufficiency
- **Quantitative and Data Reasoning** (`quantitative_data_reasoning`) — replaces
  the old label “Mathematical Analysis”.
  Quantitative logic · Numerical relationships · Tables and data reasoning ·
  Charts and graph reasoning · Optimisation and decision-making · Rates,
  comparisons and conversions · Voting and allocation problems
- **Abstract and Spatial Reasoning** (`abstract_spatial_reasoning`)
  Pattern recognition · Shape and symbol sequences · Codes and symbolic
  reasoning · Matrices and visual analogies · Odd one out and classification ·
  Rotation and reflection · Paper folding · 2D spatial assembly · 3D views and nets

### Writing  *(admin visible only — not a student practice category yet)*

Writing has no student-facing domains/subtopics. It is classified by admin
metadata dimensions:

- **Form**: narrative · diary entry · newspaper report · article · advice sheet ·
  letter or email · speech · review · description · persuasive response ·
  informative response
- **Purpose**: inform · persuade · entertain · describe · reflect · advise
- **Prompt stimulus**: scenario · image · title · theme · opening sentence ·
  audience and purpose · combination prompt

---

## 4. Student-facing vs admin-only

`studentVisible` / `adminVisible` flags gate each node:

- `getStudentVisibleSubjects()` / `getStudentVisibleTaxonomy()` — Reading,
  Mathematical Reasoning, Thinking Skills.
- `getAdminVisibleSubjects()` / `getAdminVisibleTaxonomy()` — the above **plus
  Writing**.

Student-facing fields exposed today are subject/topic/difficulty (existing) — the
canonical codes drive admin classification, coverage and analytics and are the
foundation for future student subtopic mastery (not built in this session).

---

## 5. Legacy mappings

The live database predates this taxonomy and has drifted (duplicate topics,
overlapping labels). Legacy values map **non-destructively** into canonical
codes; existing rows are preserved and remain readable/editable.

`resolveLegacyTaxonomy(rawSlugOrLabel)` accepts either a slug or a display label
(normalised by dropping non-alphanumerics) and returns `{ matched, mapping,
needsReview }`. **Unknown values are flagged for review — never silently
discarded.**

Documented examples:

| Legacy value | Canonical placement |
|---|---|
| Extracts | Reading › Comprehension and Comparison |
| Narrative | Reading, **stimulus genre** = Narrative fiction |
| Poetry | Reading › Poetry |
| Area | Measurement… › Area and perimeter |
| Perimeter | Measurement… › Area and perimeter |
| Mathematical analysis | Thinking Skills › Quantitative and Data Reasoning |
| Arguments | Thinking Skills › Arguments and Evidence |
| Logic | Thinking Skills › Logic and Deduction |
| Abstract reasoning | Thinking Skills › Abstract and Spatial Reasoning |
| Drawing conclusions | Thinking Skills › Logic and Deduction › Drawing conclusions |
| Arithmetic Operations | Number and Algebra › Arithmetic and number reasoning |
| Time | Measurement… › Time and timetables |
| Vocabulary (subject) | Reading › Cloze and Language |

The migration backfills `domain_code` / `subtopic_code` (and, where implied,
`stimulus_genre` / `writing_form`) from each question's legacy topic /
question-type slug using the same map — filling only NULLs. On the edit form,
questions with no stored codes fall back to the legacy mapping so the form is
pre-populated for confirmation.

---

## 6. Helper functions (`@/lib/taxonomy`)

- Hierarchy: `getSubjects`, `getStudentVisibleSubjects`, `getAdminVisibleSubjects`,
  `getDomainsForSubject`, `getSubtopicsForDomain`, `getSuggestedSkillsForSubtopic`,
  `getSubject/getDomain/getSubtopic/getSkill`, `getAllDomains/…Subtopics/…Skills`.
- Labels: `getSubjectLabel/getDomainLabel/getSubtopicLabel/getSkillLabel`,
  `getLabelForCode`, `getBreadcrumb`.
- Validation: `validateCombination`, `isValidDomainForSubject`,
  `isValidSubtopicForDomain`, `isValidSkillForSubtopic`, `isValidDimensionValue`.
- Legacy: `resolveLegacyTaxonomy`, `resolveLegacySubject`,
  `resolveLegacyWritingForm`, `normalizeLegacyKey`.
- Views / UI: `getStudentVisibleTaxonomy`, `getAdminVisibleTaxonomy`,
  `subjectItemsMap`, `domainItemsMap`, `subtopicItemsMap`, `skillItemsMap`,
  `dimensionItemsMap`, `getDimensionLabel`.

---

## 7. Examples

```ts
import {
  getDomainsForSubject,
  validateCombination,
  resolveLegacyTaxonomy,
} from '@/lib/taxonomy'

getDomainsForSubject('mathematical_reasoning').map((d) => d.code)
// ['number_algebra', 'measurement_financial', 'geometry_spatial', 'data_probability']

validateCombination({
  subjectCode: 'mathematical_reasoning',
  domainCode: 'measurement_financial',
  subtopicCode: 'area_and_perimeter',
  skillCode: 'composite_area',
}).valid // true

validateCombination({ subjectCode: 'reading', domainCode: 'number_algebra' }).valid // false

resolveLegacyTaxonomy('Mathematical analysis').mapping
// { subjectCode: 'thinking_skills', domainCode: 'quantitative_data_reasoning', note: '…' }
```

CSV round-trip: the v2 template and full export both carry `domain_code`,
`subtopic_code`, `skill_code`, `pattern_key`, `question_family`,
`stimulus_format`, `stimulus_genre`, `asset_render_method`, `writing_form`,
`writing_purpose`, `writing_prompt_stimulus` (appended after `status`). Import
validates each code, drops unknown/inconsistent ones with a warning, and falls
back to the legacy topic mapping when codes are absent.

---

## 8. How to add a future subtopic (or skill)

1. Add the `{ code, label }` entry under the right domain in `RAW_TAXONOMY` in
   `canonical-taxonomy.ts` (append to keep sort order stable; codes are frozen
   once shipped).
2. If replacing/renaming a legacy value, add a `LEGACY_TAXONOMY` entry so old
   data resolves.
3. Run `npm test` — the uniqueness and parent/child tests must stay green.
4. No migration is needed to *use* a new code (columns are free text). Optionally
   add a backfill migration if existing rows should adopt it.
5. `npm run build` to confirm types and the app compile.

**Never** turn a stimulus type, text genre or image type into a subtopic (see §1).
