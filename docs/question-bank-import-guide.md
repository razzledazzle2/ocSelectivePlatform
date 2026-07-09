# Question Bank Import Guide

This guide explains how to author, validate and import questions into the OC/Selective platform's question bank using the v2 CSV format. The companion template with the exact header and four worked example rows lives at [`docs/question-import-template-v2.csv`](./question-import-template-v2.csv).

---

## 1. Overview

The question bank is built around five related ideas:

- **Questions** — the individual items students practise. Each question carries its content (question text, options, answers, solutions), its metadata (difficulty, marks, timing, sources) and its classification.
- **Shared stimuli** — reading passages, poems, tables, charts, logic grids and similar material that several questions refer to. A stimulus is stored once and linked to every question that uses it, so a five-question comprehension set shares one passage.
- **Assets** — images and other media attached to stimuli, question bodies, solutions or individual options. Assets can be referenced before they exist ("pending" assets) so that content authoring and image production can proceed in parallel.
- **Taxonomy** — a hierarchy plus free tags:

  ```text
  subject → strand → topic → essential question type → variant type
                                                        + skill tags
                                                        + concept tags
                                                        + general tags
  ```

  The hierarchy gives structured navigation and reporting; the three tag families give flexible cross-cutting classification (skills a question exercises, concepts it tests, and anything else worth filtering on).
- **Lifecycle** — every question moves through `draft → reviewed → published → archived`. Imported questions should always start as `draft`. A human reviews the item, marks it `reviewed`, then publishes it. **Students only ever see `published` questions.** Archiving retires a question without deleting its attempt history.

---

## 2. CSV schema reference

The file must be UTF-8, RFC 4180 quoted (wrap a field in double quotes if it contains commas, double quotes or newlines; double any embedded quotes), with the exact 45-column header from the template.

### Column reference

| # | Column | Required | Format | Notes |
|---|--------|----------|--------|-------|
| 1 | `external_id` | Recommended | slug | Your stable identifier for the row (e.g. `mr-perc-001`). Used for duplicate detection and round-trip export. |
| 2 | `subject` | **Yes** | text | Must match an existing subject, e.g. `Mathematical Reasoning`, `Reading`, `Thinking Skills`, `Writing`. |
| 3 | `strand` | No | text | Sub-area within the subject, e.g. `Number and Algebra`, `Comprehension`. |
| 4 | `topic` | **Yes** | text | Auto-created under the subject if it does not exist (when the setting is on). |
| 5 | `essential_question_type` | Recommended | text | The canonical question archetype, e.g. `Percentage of a Quantity`, `Character Inference`. Auto-creatable. |
| 6 | `variant_type` | No | slug/text | A flavour of the essential type, e.g. `discount`, `narrative`. Auto-creatable. |
| 7 | `exam_type` | **Yes** | `OC` \| `Selective` | Which exam stream the question targets. |
| 8 | `year_level` | Recommended | `5` \| `6` | Intended student year level. |
| 9 | `difficulty` | **Yes** | integer 1–5 | 1 = easiest, 5 = hardest. Author's estimate; see §10 on calibration. |
| 10 | `marks` | Recommended | integer | Usually `1` for multiple choice; e.g. `20` for a writing task. |
| 11 | `time_limit_seconds` | No | integer | Suggested time per question (e.g. `60`); `1800` for a 30-minute writing task. |
| 12 | `answer_format` | **Yes** | `single_choice` \| `extended_response` | Drives the required-field matrix below. |
| 13 | `question_text` | **Yes** | Markdown | The question stem. Supports pipe tables, `**bold**`, `*italic*` (see §6). |
| 14–18 | `option_a` … `option_e` | single_choice | text | 4 or 5 options. Leave `option_e` empty for 4-option questions. Forbidden for `extended_response`. |
| 19 | `option_asset_refs_json` | No | JSON map | Per-option image refs, e.g. `{"A":"asset://pending/net-a.png","B":"..."}` — used for visual options instead of (or as well as) option text. |
| 20 | `option_explanations_json` | Recommended | JSON map | Why each option is right/wrong, keyed by label: `{"A":"...","B":"..."}`. Powers mistake review. |
| 21 | `correct_answer` | single_choice | `A`–`E` | The correct option label. Forbidden for `extended_response`. |
| 22 | `worked_solution` | Recommended | Markdown | Full step-by-step solution shown after an attempt. |
| 23 | `short_explanation` | No | text | One-line takeaway for quick review. |
| 24 | `stimulus_id` | For stimulus questions | slug | External reference grouping rows to one shared stimulus (see §3), e.g. `stim-read-narrative-01`. |
| 25 | `stimulus_title` | First row of a group | text | Define once per `stimulus_id`; leave empty on rows that reuse it. |
| 26 | `stimulus_type` | First row of a group | enum | See the valid values in §3. |
| 27 | `stimulus_text` | First row of a group | Markdown | The stimulus body. Supports Markdown tables. |
| 28 | `stimulus_asset_refs` | No | refs, `;`-separated | Assets attached to the stimulus (see §4). |
| 29 | `question_asset_refs` | No | refs, `;`-separated | Assets attached to the question body. |
| 30 | `solution_asset_refs` | No | refs, `;`-separated | Assets attached to the worked solution. |
| 31 | `input_method` | Recommended | `options` \| `textarea` | How the student answers. `options` for single choice, `textarea` for extended response. |
| 32 | `display_mode` | No | `standard` \| `split_stimulus` | `split_stimulus` shows the stimulus beside the question (comprehension sets). |
| 33 | `answer_validation_json` | No | JSON | Reserved for non-multiple-choice auto-marking rules (numeric tolerance, accepted strings). Leave empty unless instructed. |
| 34 | `rubric_json` | extended_response | JSON | Marking rubric for writing tasks (see §5). Single-line compact JSON, quotes doubled per RFC 4180. |
| 35 | `skill_tags` | Recommended | kebab-case, `,`-separated | Skills exercised, e.g. `calculate-percentage-of-quantity,apply-discount`. Quote the cell. |
| 36 | `concept_tags` | Recommended | kebab-case, `,`-separated | Concepts tested, e.g. `percentages,money`. |
| 37 | `tags` | No | kebab-case, `,`-separated | Anything else, e.g. `one-step,no-calculator`. |
| 38 | `source_name` | Recommended | text | Provenance, e.g. `original-example`, an internal author name, or a licensed source. |
| 39 | `source_paper` | No | text | Paper/booklet the item derives from, if any. |
| 40 | `source_section` | No | text | Section within the source. |
| 41 | `source_question_number` | No | text | Question number within the source. |
| 42 | `license_notes` | Recommended | text | Copyright/licence statement. Original content should say so explicitly. |
| 43 | `asset_generation_prompt` | No | text | Brief for an image that still needs to be produced (see §4). |
| 44 | `asset_alt_text` | No | text | Accessibility alt text for the question's imagery; also shown in pending-asset placeholders. |
| 45 | `status` | **Yes** | `draft` \| `reviewed` \| `published` \| `archived` | Import as `draft` unless you have a strong reason not to. |

### Required-by-format matrix

| Field | `single_choice` | `extended_response` |
|-------|-----------------|---------------------|
| `question_text` | Required | Required |
| `subject` | Required | Required |
| `topic` | Required (auto-creatable) | Required (auto-creatable) |
| `difficulty` | Required | Required |
| `exam_type` | Required | Required |
| `option_a`–`option_e` | Required: 4–5 options (text, or per-label refs in `option_asset_refs_json` for visual options) | **Forbidden** |
| `correct_answer` | Required (`A`–`E`) | **Forbidden** |
| `worked_solution` | Strongly recommended | Optional (use `rubric_json.sampleAnswerNotes` instead) |
| `rubric_json` | Not used | **Required** |
| `input_method` | `options` | `textarea` |

Rows that violate the matrix are rejected at preview with a row-level error (see §8).

### CSV quoting quick reference

| Situation | What to do | Example cell as it appears in the file |
|-----------|------------|----------------------------------------|
| Field contains a comma | Wrap the field in double quotes | `"State your position, then justify it."` |
| Field contains a double quote | Wrap in quotes and double the embedded quote | `"the word ""Reluctantly"" means"` |
| Field contains a newline | Wrap in quotes; keep the newline | Multi-line stimulus text (see §6) |
| JSON column | Compact single-line JSON, wrapped in quotes, every internal `"` doubled | `"{""A"":""..."",""B"":""...""}"` |
| Comma-separated tag list | Wrap in quotes so list commas are not column breaks | `"percentages,money,decimals"` |

A cell that needs none of the above may be left unquoted. When in doubt, quote — a quoted field with no special characters is always valid.

---

## 3. Shared stimuli

A **stimulus** is any material shared by one or more questions. Rows are grouped by `stimulus_id`, an external reference slug you invent, e.g. `stim-read-narrative-01`, `stim-example-passage-01`.

How grouping works:

1. Give every row in the set the same `stimulus_id`.
2. On **any one row** of the group, fill in `stimulus_title`, `stimulus_type` and `stimulus_text` (and `stimulus_asset_refs` if needed). Convention: put them on the first row.
3. Every other row in the group repeats only the `stimulus_id` and leaves title/type/text **empty** — the importer links them to the same stimulus record. Rows 2 and 3 of the template demonstrate exactly this.
4. If two rows define *conflicting* title/type/text for the same `stimulus_id`, the preview reports a warning and the first definition wins.

**Reusing a stimulus already in the database:** reference its existing external slug in `stimulus_id` and leave title/type/text empty. The importer resolves the reference against the DB before creating anything new, so passages imported last month can gain new questions this month.

Valid `stimulus_type` values:

| Value | Typical use |
|-------|-------------|
| `passage` | Narrative or literary prose extract |
| `paired_extract` | Two texts compared against each other |
| `poem` | Poetry |
| `information_text` | Factual/report-style text |
| `cloze_passage` | Passage with gaps for cloze questions |
| `table` | Data table (prefer Markdown tables, §6) |
| `chart` | Graph/chart image |
| `logic_grid` | Thinking Skills logic-grid setup |
| `rule_box` | Boxed set of rules/conditions questions apply |
| `writing_context` | Background material for a writing prompt |
| `image_set` | One or more images questions refer to |

---

## 4. Assets

Assets are images (diagrams, charts, nets, maps) attached to different parts of a question. Three reference syntaxes are accepted anywhere an asset ref is expected:

| Syntax | Meaning |
|--------|---------|
| `asset://pending/<name>.<ext>` | A file that does **not exist yet**. Import creates a *pending asset* record; if the row carries a supported `asset_spec_json` (or a committed spec file exists for that name) the SVG is generated automatically at import — otherwise upload/generate later. |
| `asset://question-assets/generated/<name>.svg` | A committed, deterministically generated SVG served from `/question-assets/…`. |
| `https://...` | An already-hosted image URL. |
| `<path>` | A storage path inside the `question-media` bucket, e.g. `diagrams/triangle-01.png`. |

Where refs go:

- `stimulus_asset_refs`, `question_asset_refs`, `solution_asset_refs` — **semicolon-separated** lists of refs attached to the stimulus, the question body and the worked solution respectively. Example: `asset://pending/spinner.png;asset://pending/spinner-labels.png`.
- `option_asset_refs_json` — a JSON map from option label to a single ref, for visual answer options: `{"A":"asset://pending/net-a.png","B":"asset://pending/net-b.png"}`. An option may be image-only (empty `option_x` text) as long as the ref is present.

Describing / generating images:

- `asset_generation_prompt` — a concise brief a designer can work from, e.g. *"Spinner divided into 8 equal sectors…"*. Never used for AI image generation of assessed diagrams.
- `asset_alt_text` — the accessibility text for the finished image. It is also what students would see if the asset were ever missing.
- `asset_spec_json` — the structured spec a **deterministic** maths/thinking-skills diagram is drawn from (e.g. `{"type":"pie_chart",…}`). When present with a supported `type`, the SVG is generated automatically at import.
- `asset_status` — explicit lifecycle override (`pending`/`generated`/`approved`/…); usually left blank and inferred.

**Auto-generation.** A pending ref with a supported `asset_spec_json` becomes a committed SVG at import (no CLI). Anything unsupported stays pending — you can generate it later without re-importing via **Generate missing assets** (Question Bank toolbar) or the per-question **Generate asset** button. See [`question-asset-pipeline.md`](question-asset-pipeline.md).

**Placeholders:** until an asset is generated/uploaded, the app renders a clean placeholder showing the alt text, so draft questions stay reviewable end-to-end. Publishing is blocked while any required asset is still pending or rejected.

---

## 5. Writing rubrics (`rubric_json`)

Extended-response questions carry their marking scheme in `rubric_json`. Structure, annotated:

```jsonc
{
  // What kind of piece the prompt asks for. One of:
  // narrative, persuasive, informative, discursive, report, advice_sheet,
  // speech, letter, diary, recount, description, hybrid
  "textType": "persuasive",

  // Marking criteria. maxMarks should sum to the row's `marks` value.
  "criteria": [
    { "name": "Ideas",       "description": "Relevance, depth and originality of ideas", "maxMarks": 8 },
    { "name": "Structure",   "description": "Introduction, paragraphing, cohesion, conclusion", "maxMarks": 6 },
    { "name": "Language",    "description": "Vocabulary, sentence variety, persuasive devices", "maxMarks": 4 },
    { "name": "Conventions", "description": "Spelling, punctuation, grammar", "maxMarks": 2 }
  ],

  // Holistic bands mapped onto the total score.
  "scoreBands": [
    { "band": "Excellent",  "range": "17-20", "descriptor": "Compelling, well-organised argument sustained throughout, with persuasive language and accurate conventions" },
    { "band": "Strong",     "range": "13-16", "descriptor": "Clear position with mostly convincing support and sound structure" },
    { "band": "Developing", "range": "8-12",  "descriptor": "Position stated but support is thin or organisation uneven" },
    { "band": "Emerging",   "range": "0-7",   "descriptor": "Position unclear; ideas fragmentary; frequent errors impede meaning" }
  ],

  // Guidance for whoever marks or reviews sample answers.
  "sampleAnswerNotes": "A strong response takes one side, offers 2-3 developed reasons, anticipates a counter-argument, and closes with a call to action.",

  // Hints surfaced to the student during planning time.
  "planningHints": ["State your position early", "One reason per paragraph", "End with a call to action"]
}
```

In the CSV the JSON must be **compact single-line**, wrapped in quotes with every internal `"` doubled — see row 4 of the template for a correctly escaped example.

---

## 6. Markdown tables in question and stimulus text

`question_text` and `stimulus_text` support a subset of GitHub-flavoured Markdown that the app renders natively: **pipe tables**, `**bold**` and `*italic*`. Prefer a Markdown table over an image for timetables, price lists, tally charts and similar data — tables stay crisp at any size, are accessible, and need no asset pipeline.

Example inside a quoted CSV cell (quotes shown doubled as they would appear in the file):

```text
"The table shows the bus timetable.

| Stop | Bus A | Bus B |
|------|-------|-------|
| Mall | 9:05  | 9:20  |
| Pool | 9:17  | 9:32  |

**How long** does Bus A take from the Mall to the Pool?"
```

Note the embedded newlines: they are legal inside a quoted field (RFC 4180) and preserved on import.

---

## 7. Generating question batches with an LLM

The CSV format is designed so an LLM can draft large batches that humans then review. Ground rules:

1. Give the model the **exact 45-column header** and the field conventions (§2), plus the taxonomy values you want targeted.
2. Enforce **originality**: the model must write new passages, numbers and scenarios — never reproduce or closely paraphrase official OC/Selective papers or other copyrighted material. Set `source_name` to something like `ai-generated-batch-<date>` and record the constraint in `license_notes`.
3. Always generate with `status` = `draft`. Humans review each item, mark it `reviewed`, then publish. Never bulk-publish machine output.
4. Ask for RFC 4180 quoting and compact single-line JSON in JSON columns, and spot-check the file in a CSV-aware editor before importing.

Reusable prompt template:

```text
You are writing original practice questions for a NSW OC/Selective preparation platform.

Output: raw CSV only (no commentary, no code fences), starting with this exact header:
<paste the 45-column header from docs/question-import-template-v2.csv>

Produce <N> rows for:
- subject: <subject>; strand: <strand>; topic: <topic>
- essential_question_type: <type>; variant_type: <variant>
- exam_type: <OC|Selective>; year_level: <5|6>; difficulty mix: <e.g. 2x2, 2x3, 1x4>

Conventions:
- answer_format single_choice: 4-5 options (A-E), one correct_answer label,
  option_explanations_json for every option, full worked_solution.
- answer_format extended_response: no options/correct_answer; rubric_json with
  textType, criteria (maxMarks summing to marks), scoreBands, planningHints.
- Shared stimuli: same stimulus_id (slug like stim-<subject>-<theme>-01) on every
  row of a set; define stimulus_title/type/text on the first row only.
- Tags: kebab-case, comma-separated inside a quoted cell.
- status = draft on every row. source_name = <batch name>. license_notes must state
  the content is original.
- RFC 4180: quote any field containing commas, quotes or newlines; double embedded
  quotes; JSON columns are compact single-line JSON.

Originality: every passage, scenario and number set must be newly invented. Do NOT
copy, adapt or paraphrase questions from official past papers or any published
test-prep material.
```

---

## 8. Import workflow for admins

1. Open **Admin → Import**.
2. Choose your CSV file (or paste rows directly).
3. Set the import options:
   - **Import status** — the lifecycle status applied to imported rows (keep `draft`).
   - **Auto-create topics / question types** — allow the importer to create missing taxonomy nodes rather than erroring.
   - **Block duplicates** — reject rows that match existing questions (below).
4. **Preview** — the importer validates every row and shows row-level results:
   - *Errors* (row is skipped): missing required columns, unknown subject, invalid enum values, malformed JSON, correct_answer pointing at an empty option, rubric missing on an extended_response row.
   - *Warnings* (row imports, flagged): missing worked solution, conflicting stimulus definitions, unusually long options, pending assets without alt text.
5. **Import** — valid rows are written in one pass.

### Common preview messages

| Message | Severity | Fix |
|---------|----------|-----|
| Unknown subject | Error | Subjects are not auto-created; use an existing subject name exactly. |
| Missing correct_answer | Error | Every `single_choice` row needs a label `A`–`E` that points at a non-empty option. |
| correct_answer refers to empty option | Error | The label must match an option with text or an entry in `option_asset_refs_json`. |
| Invalid JSON in `rubric_json` / `option_explanations_json` | Error | Validate the JSON; check that embedded quotes are doubled, not backslash-escaped. |
| `extended_response` row has options | Error | Remove `option_a`–`option_e` and `correct_answer`; supply `rubric_json`. |
| Stimulus definition conflicts with an earlier row | Warning | Only one row per `stimulus_id` should carry title/type/text. |
| No worked_solution | Warning | Strongly recommended for every `single_choice` question — it powers mistake review. |
| Pending asset without `asset_alt_text` | Warning | Add alt text so the placeholder (and final image) are accessible. |
| Duplicate of existing question | Skipped | Matched by `external_id` or normalised question text; see duplicate rules below.

What gets **auto-created** during import (when enabled): topics, essential question types, variant types, shared stimuli (one per new `stimulus_id`), and pending asset records for every `asset://pending/...` reference.

**Duplicate rules.** A row is treated as a duplicate when either:

- its `external_id` matches an existing question's external id, or
- its normalised question text (whitespace collapsed, case-folded, punctuation-insensitive) matches an existing question.

With *Block duplicates* on, such rows are skipped and reported; use a fresh `external_id` and genuinely new content rather than switching the setting off.

---

## 9. Export and round-tripping

The admin question bank offers a **full export** in this same v2 CSV format, honouring whatever filters are currently applied (subject, topic, status, tag, search). Round-trip guarantees:

- `stimulus_id` references are preserved, with title/type/text emitted once per stimulus group;
- asset references (pending, URL and bucket-path forms) are emitted exactly as stored;
- `rubric_json`, `option_explanations_json` and other JSON columns come back as compact single-line JSON;
- all three tag families are preserved in kebab-case comma-separated form.

An exported file re-imports cleanly, so export → edit in a spreadsheet → re-import is a supported bulk-editing path (duplicate detection via `external_id` will match the existing rows — choose update-vs-skip deliberately).

---

## 10. Analytics readiness

Every student answer is recorded in `question_attempts` (correctness, selected option label, time taken). That means each imported question automatically accumulates per-question statistics once published:

- attempt count,
- percentage correct,
- average time taken,
- most common wrong answer (a strong signal of a misleading distractor or a mis-keyed answer).

Author-assigned `difficulty` (1–5) is an estimate; **empirical difficulty calibration** — adjusting difficulty from observed correctness rates — is planned future work. Writing good `option_explanations_json` now pays off later: the most-common-wrong-answer statistic combined with per-option explanations feeds the mistake-review loop directly.

---

## Pre-import checklist

- [ ] Header matches the template exactly (45 columns, same order).
- [ ] Every row satisfies the required-by-format matrix (§2).
- [ ] Each `stimulus_id` group defines title/type/text on exactly one row (§3).
- [ ] All JSON columns parse as compact single-line JSON (§2, §5).
- [ ] Pending asset refs have `asset_alt_text`, and generation briefs where needed (§4).
- [ ] `status` is `draft` on every row; provenance recorded in `source_name` / `license_notes`.
- [ ] Content is original — nothing copied or paraphrased from official papers (§7).
