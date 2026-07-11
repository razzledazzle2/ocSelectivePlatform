// matrix_pattern — an N×M grid of framed cells, each holding a glyph, with one
// cell (usually bottom-right) shown as a dashed "?". Used for matrix-reasoning
// thinking-skills stimuli. The rule is encoded entirely in the authored spec.
//
// Spec shape:
// {
//   type: "matrix_pattern",
//   width?, height?, title?,
//   rows, cols,
//   cell_size?,
//   // grid is a rows×cols array; each entry is { glyph:{...} } or { question:true }
//   grid: [ [ {glyph} | {question:true}, ... ], ... ]
// }

import { PALETTE, svgDocument, text } from './svg-core.mjs'
import { cellBox, drawGlyph } from './shapes.mjs'

const GAP = 14
const MARGIN = 20

export function renderMatrixPattern(spec) {
  const rows = spec.rows ?? (spec.grid ? spec.grid.length : 3)
  const cols = spec.cols ?? (spec.grid?.[0] ? spec.grid[0].length : 3)
  const cellSize = spec.cell_size ?? 82
  const titleHeight = spec.title ? 30 : 0
  const width = spec.width ?? MARGIN * 2 + cols * cellSize + (cols - 1) * GAP
  const height = spec.height ?? MARGIN * 2 + titleHeight + rows * cellSize + (rows - 1) * GAP

  const body = []
  if (spec.title) {
    body.push(text(width / 2, 20, spec.title, { anchor: 'middle', size: 13, weight: 700, fill: PALETTE.ink }))
  }

  const top = MARGIN + titleHeight
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const cell = spec.grid?.[r]?.[c] ?? {}
      const x = MARGIN + c * (cellSize + GAP)
      const y = top + r * (cellSize + GAP)
      body.push(cellBox(x, y, cellSize, { question: Boolean(cell.question) }))
      if (!cell.question) {
        // A cell holds one glyph (`glyph`) or several stacked/offset ones
        // (`glyphs`), e.g. an outer shape with a smaller shape nested inside.
        const glyphs = cell.glyphs ?? (cell.glyph ? [cell.glyph] : [])
        for (const glyph of glyphs) {
          const gx = x + cellSize / 2 + (glyph.dx ?? 0) * cellSize
          const gy = y + cellSize / 2 + (glyph.dy ?? 0) * cellSize
          body.push(drawGlyph(gx, gy, cellSize, glyph))
        }
      }
    }
  }

  return svgDocument({ width, height, title: spec.title ?? spec.alt_text, body: body.join('') })
}
