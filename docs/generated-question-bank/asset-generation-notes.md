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

## Generator coverage

| Spec `type` | Status | Generator |
|-------------|--------|-----------|
| `coordinate_grid` | ✅ implemented | `coordinate-grid.mjs` (polygons, points, segments, mirror lines, translation arrows, right-angle markers) |
| `geometry_polygon` | ✅ implemented | delegates to `coordinate-grid.mjs` |
| `translation_arrow` | ✅ implemented | delegates to `coordinate-grid.mjs` |
| `bar_chart` | ✅ implemented | `bar-chart.mjs` |
| `line_chart` | ✅ implemented | `line-chart.mjs` |
| `abstract_shape_sequence` | ✅ implemented | `abstract-shape-sequence.mjs` |
| `matrix_pattern` | ✅ implemented | `matrix-pattern.mjs` |
| `simple_table_visual` | ⏳ pending | recognised; generator TODO |
| `venn_diagram_basic` | ⏳ pending | recognised; generator TODO |
| `logic_grid_table` | ⏳ pending | recognised; generator TODO |

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
