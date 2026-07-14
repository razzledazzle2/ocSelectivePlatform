# Question asset pipeline

How diagrams, charts and other visuals attach to questions — from a CSV
reference, through deterministic SVG generation, to what students and admins
see. Read this before adding image-bearing questions.

## TL;DR

- A question CSV **references** assets by a string ref; it never stores binary
  image data.
- Maths / thinking-skills diagrams are **generated deterministically from a
  structured spec** — not AI image generation. The same renderer runs three
  ways: **at import time**, from the **admin UI** ("Generate missing assets" /
  per-question "Generate asset"), and offline via `npm run generate:assets`.
- Generated SVGs live in `public/question-assets/generated/` and are served at
  `/question-assets/…`. Photos/scans go in the private `question-media` bucket.
  **Commit newly generated SVGs** (they are deterministic and diff-reviewable).
- Import never fails on a missing asset: a supported spec is generated on the
  spot; anything unsupported stays `pending` with a clean "coming soon" card and
  a row-level warning — the import as a whole never breaks.
- A question **cannot be published while it has a pending or rejected asset** —
  students never see a broken required diagram.

## Reference schemes

An asset ref string is classified by [`src/lib/assets/refs.ts`](../src/lib/assets/refs.ts):

| Ref | Meaning | Stored as | Status |
|-----|---------|-----------|--------|
| `asset://pending/<name>` | placeholder, no file yet | — | `pending` |
| `asset://question-assets/<path>` | generated file committed under `public/question-assets/<path>` | `external_url = /question-assets/<path>` | `generated` |
| `https://…` | externally hosted | `external_url` | `uploaded` |
| anything else | object key in the private `question-media` bucket | `storage_path` | `uploaded` |

Example refs:

```
asset://pending/mr-geo-translation-001.svg
asset://question-assets/generated/mr4-triangle-translate.svg
```

## CSV columns

The v2 import/export template ([`csv-template.ts`](../src/lib/import/csv-template.ts),
[`export-full-csv.ts`](../src/lib/questions/export-full-csv.ts)) carries:

| Column | Purpose |
|--------|---------|
| `question_asset_refs` | `;`-separated refs shown with the question stem |
| `stimulus_asset_refs` | refs on the shared stimulus |
| `solution_asset_refs` | refs shown with the worked solution |
| `option_asset_refs_json` | `{"A":"asset://…"}` visual answer options |
| `asset_generation_prompt` | natural-language description (authoring aid / fallback) |
| `asset_alt_text` | accessible alt text (used in the SVG `<title>` and `<img alt>`) |
| `asset_spec_json` | the structured spec the SVG is generated from |
| `asset_status` | explicit lifecycle override (`pending`/`generated`/`approved`/…) |

Import (`asset_generation_prompt`, `asset_alt_text`, `asset_spec_json`,
`asset_status`) applies at the **row** level to every asset that row creates.
Export re-emits `asset_generation_prompt`, `asset_alt_text` and `asset_status`
from the first question-role asset. `asset_spec_json` is **not** DB-sourced on
export (the `spec` column ships in a not-yet-pushed migration, and the spec's
canonical home is the committed spec files + `asset-manifest.csv`); re-enable
DB-sourced spec export by adding `spec` to `ExportAssetMeta` once the migration
is live.

## Asset model

Assets live in the `public.assets` table (migration `20260706081942`, extended by
`20260708001849`). Requested pipeline fields map to columns:

| Pipeline field | Column |
|----------------|--------|
| `asset_id` | `id` |
| `asset_ref` | `external_ref` |
| `asset_type` | `asset_type` (`image`/`diagram`/`svg`/`table`/`chart`/`audio`) |
| `asset_status` | `status` (`pending`/`generated`/`uploaded`/`approved`/`rejected`/`archived`) |
| `asset_alt_text` | `alt_text` |
| `asset_generation_prompt` | `generation_prompt` |
| `asset_spec_json` | `spec` (jsonb) |
| `storage_path` | `storage_path` |
| `linked_question_id` | via `question_assets` (role `question`/`solution`) |
| `linked_stimulus_id` | via `stimulus_assets` |
| `created_at` / `updated_at` | same |

## Generating SVGs

1. Author a spec file in `docs/generated-question-bank/asset-specs/<name>.json`:

   ```json
   {
     "asset_ref": "asset://question-assets/generated/mr4-triangle-translate.svg",
     "external_id": "mr4-001",
     "asset_type": "svg",
     "alt_text": "A coordinate grid numbered 0 to 8 …",
     "spec": { "type": "coordinate_grid", "x_min": 0, "x_max": 8, "shapes": [ … ] }
   }
   ```

2. Run the generator:

   ```bash
   npm run generate:assets            # all specs
   node scripts/generate-assets.mjs mr4-001   # one, by id/filename
   ```

   It writes `public/question-assets/generated/<name>.svg` and rewrites
   `docs/generated-question-bank/asset-manifest.csv`. A spec whose `type` is
   recognised but not yet implemented is **reported and skipped**, never emitted
   as a wrong diagram.

3. Point the CSV row's `question_asset_refs` at the generated ref and re-import.

## In-app generation (no CLI)

`npm run generate:assets` is still available for batch/offline runs, but it is no
longer the only way. The same deterministic renderer
([`scripts/lib/svg/render.mjs`](../scripts/lib/svg/render.mjs)) is reused
server-side by [`src/lib/assets/generate.ts`](../src/lib/assets/generate.ts), so
admins never have to touch the terminal.

**At import time.** When a CSV row has a `pending` ref backed by a supported
`asset_spec_json` (or a committed spec file for that ref), the importer renders
the SVG, writes it to `public/question-assets/generated/`, stores the asset row
as `generated` with the public ref, and reports `generated N diagram(s)`. If the
SVG is already committed, it just repoints (no re-render). Generation failures or
unsupported types **never break the import** — the asset stays `pending` and a
warning is surfaced. The row-level spec is only ever paired with the question's
single main diagram, never with an option image (option specs live in their own
committed spec files, keyed by ref).

**From the admin UI** (all in the Question Bank, no re-import needed):

- **Generate missing assets** (bank toolbar) — renders every pending
  deterministic asset in the bank and flips it to `generated`. This is also the
  **sync path for already-imported questions**: it updates the existing asset row
  in place (same id, links intact) — it never deletes or duplicates a question.
- **Generate asset** (per question, in the Question assets panel) — generates the
  pending assets for the selected question only.
- **Regenerate** (per generated asset) — re-renders from the stored spec. Refuses
  `approved`/`uploaded` assets so a human-cleared asset is never overwritten.

Entry points: [`src/lib/assets/generate-missing.ts`](../src/lib/assets/generate-missing.ts)
and the server actions in
[`src/app/admin/questions/asset-actions.ts`](../src/app/admin/questions/asset-actions.ts).
A row is **never** marked `generated` unless its SVG actually exists on disk.

Generators live in [`scripts/lib/svg/`](../scripts/lib/svg/). Implemented today:
`coordinate_grid`, `geometry_polygon` (grid form **and** labelled-sides form),
`translation_arrow`, `bar_chart`, `line_chart`, `pie_chart`,
`abstract_shape_sequence`, `matrix_pattern`, `isometric_cube_stack`,
`symbol_key`, `shape_analogy`, `rotation`, `reflection`, `paper_folding`,
`isometric_3d_views`, `spatial_assembly`. Recognised-but-pending (no generator
yet, so specs stay `pending`): `simple_table_visual`, `venn_diagram_basic`,
`logic_grid_table`, `scene_illustration` (the last is intentional — decorative,
no AI).

To backfill the CSV `asset_spec_json` / `asset_status` columns across the whole
bank, run `node scripts/normalize-asset-columns.mjs` (idempotent). It reads
generatable specs from `asset-specs/` and pending specs from
`pending-specs.json`, and only marks a row `generated` when its SVG exists.

## How the renderer handles assets

[`QuestionAsset`](../src/components/questions/question-asset.tsx) resolves, in order:

1. `external_url` (or an `external_ref` resolving to a public/external URL) →
   direct `<img>` — this is how generated SVGs render.
2. a `storage_path` on a usable asset → short-lived signed URL from the private
   `question-media` bucket.
3. otherwise → a clean placeholder card (never a broken image).

Tables/charts written as markdown render through `QuestionMarkdown`; assets are
for true visuals (diagrams, charts-as-images, photos).

## Admin review

Generation is deliberately **not** auto-publish. The lifecycle stays
`pending → generated → (admin reviews) → approved → published`.

- The question preview pane shows a **Question assets** panel: a status badge per
  asset (Pending / Generated / Uploaded / Approved / Rejected / Missing), a
  **Generate asset** button for pending diagrams, a **Regenerate** button on
  generated ones, and, for anything pending, a card with the ref, alt text and
  generation prompt.
- The question bank has an **asset filter** (Has asset / Pending asset / Missing
  asset / Asset approved), a "Pending asset" badge on list rows, and a
  **Generate missing assets** button in the list toolbar.
- **Publish is blocked** when a question still has a `pending` or `rejected`
  asset (`assertAssetsReadyForPublish` in
  [`mutations.ts`](../src/lib/questions/mutations.ts)). A freshly `generated`
  asset can be previewed but should be reviewed/approved before publishing.

## Validation

`npm run validate:assets` ([`scripts/validate-assets.mjs`](../scripts/validate-assets.mjs))
checks the pipeline is internally consistent and fails on any violation:

- every generated ref (spec files, manifest, question CSVs) resolves to a real
  SVG on disk;
- nothing is marked `generated` without its SVG existing;
- every spec `type` is known; implemented types have a committed SVG; pending
  types are not silently marked generated;
- `option_asset_refs_json` refs are validated like any other;
- no question CSV reuses an `external_id` (would import as a duplicate);
- no row is `asset_status=generated` while still carrying a pending ref.

At runtime the same invariant is enforced in code: `resolveAssetGeneration`
only returns `generated` after the SVG is confirmed on disk, and the importer's
duplicate guard (`external_id` + normalised text) means re-import never
duplicates a question.

## SVG vs image generation — when to use which

- **SVG from a spec (default for maths & thinking skills).** Coordinate grids,
  polygons, bar/line/pie charts, matrices, sequences, Venn diagrams — anything
  whose correctness depends on exact numbers/positions. Deterministic, tiny,
  crisp at any zoom, diff-reviewable, accessible.
- **Uploaded raster image.** Photographs, scanned artwork, richly illustrated
  stimuli where precision isn't the point. Store in `question-media`.
- **AI image generation is not used for precise maths diagrams** — it cannot be
  trusted to place points, label axes or count shapes correctly. It may only be
  considered for decorative, non-assessed illustration, and even then a human
  must verify it.

## Related files

- Generator (offline): [`scripts/generate-assets.mjs`](../scripts/generate-assets.mjs), [`scripts/lib/svg/`](../scripts/lib/svg/)
- Generator (in-app, shared renderer): [`src/lib/assets/generate.ts`](../src/lib/assets/generate.ts), [`src/lib/assets/generate-missing.ts`](../src/lib/assets/generate-missing.ts)
- Admin actions: [`src/app/admin/questions/asset-actions.ts`](../src/app/admin/questions/asset-actions.ts)
- Validator: [`scripts/validate-assets.mjs`](../scripts/validate-assets.mjs) (`npm run validate:assets`)
- Specs: [`docs/generated-question-bank/asset-specs/`](generated-question-bank/asset-specs/)
- Manifest: [`docs/generated-question-bank/asset-manifest.csv`](generated-question-bank/asset-manifest.csv)
- Notes: [`docs/generated-question-bank/asset-generation-notes.md`](generated-question-bank/asset-generation-notes.md)
