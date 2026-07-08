# Asset generation notes

Running log of what the deterministic SVG pipeline has produced, plus per-type
authoring notes. See [`../question-asset-pipeline.md`](../question-asset-pipeline.md)
for the full pipeline.

## Pilot batch (2026-07-08)

Five pending diagram questions were converted from `asset://pending/*.png`
placeholders to real generated SVGs. Specs are in
[`asset-specs/`](asset-specs/); outputs in `public/question-assets/generated/`;
the CSV rows now reference the generated SVGs.

| Question | Type | Asset | Notes |
|----------|------|-------|-------|
| `mr4-001` | coordinate_grid (+ translation_arrow, right-angle marker) | `mr4-triangle-translate.svg` | The worked example: triangle P(1,1) Q(1,4) R(3,1), dashed slide arrow. Coordinate-grid / geometry pilot. |
| `mr3-rainfall` | bar_chart | `mr3-rainfall.svg` | Monthly rainfall, y 0–120 step 20. Maths chart. |
| `mr3-daytemp` | line_chart | `mr3-daytemp.svg` | Day temperature, y 0–30 step 5, dot per reading. Maths chart. |
| `ts3-010` | matrix_pattern | `ts3-matrix.svg` | 3×3: shape by column, size by row, `?` bottom-right (= large triangle). Thinking-skills abstract. |
| `ts3-009` | abstract_shape_sequence | `ts3-seq-dots.svg` | Squares holding 1→4 dots then `?` (= 5). Thinking-skills abstract. |

Meets the pilot targets: ≥2 maths charts/diagrams, ≥2 thinking-skills visuals,
≥1 coordinate-grid/geometry diagram. Regenerate with `npm run generate:assets`.

**Answer-option images (full workflow demo).** Both TS items also had their
`option_asset_refs_json` visual answers generated, so the pilot exercises
stimulus-level *and* option-level diagrams end to end:

| Question | Options (correct in bold) | Files |
|----------|---------------------------|-------|
| `ts3-009` | A=4 dots, B=6 dots, **C=5 dots**, D=3 dots | `ts3-seq-dots-{a,b,c,d}.svg` |
| `ts3-010` | A=small triangle, B=large square, **C=large triangle**, D=large circle | `ts3-matrix-{a,b,c,d}.svg` |

13 SVGs total (5 stimulus/question + 8 option).

## Full-bank scan (2026-07-08)

Scanned all four generated-question-bank CSVs. **20 visual rows** total
(Mathematical Reasoning 9, Thinking Skills 10, Writing 1, Reading 0). Every
visual row now carries `asset_generation_prompt`, `asset_alt_text`,
`asset_spec_json` and `asset_status`; refs are normalised. Columns
`asset_spec_json` + `asset_status` were added to all four CSVs (via
`scripts/normalize-asset-columns.mjs`, re-runnable).

| CSV | visual rows | generated | pending |
|-----|-------------|-----------|---------|
| mathematical-reasoning-100 | 9 | 9 | 0 |
| thinking-skills-100 | 10 | 10 | 0 |
| reading-100 | 0 | 0 | 0 |
| writing-prompts | 1 | 0 | 1 |
| **total** | **20** | **19** | **1** |

- **20/20** rows have a complete `asset_spec_json`.
- **59 SVGs** on disk (stimulus + option images).
- **1 row** remains pending: `WRITE-DESC-001` (decorative market scene — a
  naturalistic illustration, deliberately not a deterministic diagram; spec kept
  in `pending-specs.json`). It is a draft, not published.

### Round 2 — remaining pending rows completed (2026-07-08)

Eight new generators finished every remaining diagram row (stimulus **and** all
four option images each), answer keys preserved exactly:

| Row | correct | Type / generator | Files |
|-----|:-------:|------------------|-------|
| `mr2-015` | C | `isometric_cube_stack` (`isometric-cubes.mjs`) | `mr2-cube-steps.svg` (no options) |
| `ts3-011` | C | `abstract_shape_sequence` (glyph offsets) | `ts3-arrow{,-a,-b,-c,-d}.svg` |
| `ts3-012` | B | `shape_analogy` (`shape-analogy.mjs`) | `ts3-analogy{,-a…-d}.svg` |
| `ts3-013` | B | `symbol_key` (`symbol-key.mjs`) | `ts3-code{,-a…-d}.svg` |
| `ts3-014` | A | `rotation` (`figure-transform.mjs`) | `ts3-flag{,-a…-d}.svg` |
| `ts3-015` | B | `reflection` (`figure-transform.mjs`) | `ts3-mirror{,-a…-d}.svg` |
| `ts3-016` | B | `paper_folding` (`paper-folding.mjs`) | `ts3-fold{,-a…-d}.svg` |
| `ts3-017` | B | `isometric_3d_views` (`isometric-3d-views.mjs`) | `ts3-cubes{,-a…-d}.svg` |
| `ts3-018` | A | `spatial_assembly` (`spatial-assembly.mjs`) | `ts3-square{,-a…-d}.svg` |

### Still pending (1 row)

`WRITE-DESC-001` (`scene_illustration`) — decorative, non-assessed. Kept pending
by design (see rule in `../question-asset-pipeline.md`: no AI, and a naturalistic
scene is not a clean deterministic diagram).

**Unsupported asset types** (no generator, stay pending): `scene_illustration`,
`simple_table_visual`, `venn_diagram_basic`, `logic_grid_table`.

## Generator coverage

| Spec `type` | Status | Generator |
|-------------|--------|-----------|
| `coordinate_grid` | ✅ implemented | `coordinate-grid.mjs` (polygons, points, segments, mirror lines, translation arrows, right-angle markers) |
| `geometry_polygon` | ✅ implemented | `geometry-polygon.mjs` (labelled sides, not-to-scale) or `coordinate-grid.mjs` when the spec has grid `shapes` |
| `translation_arrow` | ✅ implemented | delegates to `coordinate-grid.mjs` |
| `bar_chart` | ✅ implemented | `bar-chart.mjs` |
| `line_chart` | ✅ implemented | `line-chart.mjs` |
| `pie_chart` | ✅ implemented | `pie-chart.mjs` |
| `abstract_shape_sequence` | ✅ implemented | `abstract-shape-sequence.mjs` (supports per-glyph `dx/dy` offsets) |
| `matrix_pattern` | ✅ implemented | `matrix-pattern.mjs` |
| `isometric_cube_stack` | ✅ implemented | `isometric-cubes.mjs` |
| `symbol_key` | ✅ implemented | `symbol-key.mjs` |
| `shape_analogy` | ✅ implemented | `shape-analogy.mjs` |
| `rotation` / `reflection` | ✅ implemented | `figure-transform.mjs` (flag, block letter F) |
| `paper_folding` | ✅ implemented | `paper-folding.mjs` |
| `isometric_3d_views` | ✅ implemented | `isometric-3d-views.mjs` (reuses the cube renderer) |
| `spatial_assembly` | ✅ implemented | `spatial-assembly.mjs` |
| `simple_table_visual` | ⏳ pending | recognised; generator TODO |
| `venn_diagram_basic` | ⏳ pending | recognised; generator TODO |
| `logic_grid_table` | ⏳ pending | recognised; generator TODO |
| `scene_illustration` | ⏳ pending | intentionally not built (decorative/naturalistic; no AI) |

## Authoring notes per type

- **coordinate_grid** — set `x_min/x_max/y_min/y_max` to the integer range; the
  grid, numbered axes and gridlines are drawn automatically. Shapes:
  - `polygon` — `points: [{label,x,y}]`, optional `right_angle_at:"P"`, `fill`.
  - `translation_arrow` — `from:{x,y}`, `dx`, `dy`, `label`, `style:"dashed"`.
  - `mirror_line` — `axis:"x"|"y"`, `at`, `label` (for reflections).
  - `point`, `segment`.
- **bar_chart** — `categories:[{label,value}]`, `y_max`, `y_step`. Keep values
  within `y_max`.
- **line_chart** — `points:[{label,value}]`, `y_max`, `y_step`.
- **matrix_pattern** — `grid` is a `rows`×`cols` array of `{glyph}` or
  `{question:true}`. Glyph `scale` (0.6/0.85/1.1) encodes a size feature.
- **abstract_shape_sequence** — `cells` left→right; a cell can stack shapes via
  `glyphs:[…]` (e.g. a `square` + a `dot` cluster) and the final cell is
  `{question:true}`.
- Glyph shapes: `circle`, `square`, `triangle`, `diamond`, `dot` (with `count`
  1–5), `plus`, `star`, `arrow`; each takes `fill`, `stroke`, `rotation`, `scale`.

## Rules

- **Never** author a spec that hard-codes the answer into the visible stimulus.
- Always provide `alt_text` — it becomes the SVG `<title>` and the `<img alt>`.
- Diagrams are "not to scale" unless the maths depends on scale; keep labels on.
- Prefer adding a new generator over hand-writing SVG, so every diagram of a
  type stays visually consistent and is regenerable.
