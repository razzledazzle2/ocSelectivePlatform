// abstract_shape_sequence — a left-to-right row of framed cells, each holding a
// glyph, ending in a dashed "?" cell. Used for "which figure comes next"
// thinking-skills stimuli. The rule is encoded entirely in the authored spec.
//
// Spec shape:
// {
//   type: "abstract_shape_sequence",
//   width?, height?, title?,
//   cell_size?,
//   cells: [ { glyph: {shape,...} } | { question: true } ]
// }

import { PALETTE, svgDocument, text } from './svg-core.mjs'
import { cellBox, drawGlyph } from './shapes.mjs'

const GAP = 18
const MARGIN = 20

export function renderAbstractShapeSequence(spec) {
  const cells = spec.cells ?? []
  const cellSize = spec.cell_size ?? 78
  const titleHeight = spec.title ? 30 : 0
  const width = spec.width ?? MARGIN * 2 + cells.length * cellSize + (cells.length - 1) * GAP
  const height = spec.height ?? MARGIN * 2 + titleHeight + cellSize

  const body = []
  if (spec.title) {
    body.push(text(width / 2, 20, spec.title, { anchor: 'middle', size: 13, weight: 700, fill: PALETTE.ink }))
  }

  const top = MARGIN + titleHeight
  cells.forEach((cell, index) => {
    const x = MARGIN + index * (cellSize + GAP)
    body.push(cellBox(x, top, cellSize, { question: Boolean(cell.question) }))
    if (!cell.question) {
      // A cell may hold one glyph (`glyph`) or several stacked ones (`glyphs`),
      // e.g. a square outline with a cluster of dots inside it.
      const glyphs = cell.glyphs ?? (cell.glyph ? [cell.glyph] : [])
      for (const glyph of glyphs) {
        // Optional per-glyph offset (fraction of the cell) lets two glyphs sit
        // side by side, e.g. an arrow next to a circle.
        const gx = x + cellSize / 2 + (glyph.dx ?? 0) * cellSize
        const gy = top + cellSize / 2 + (glyph.dy ?? 0) * cellSize
        body.push(drawGlyph(gx, gy, cellSize, glyph))
      }
    }
  })

  return svgDocument({ width, height, title: spec.title ?? spec.alt_text, body: body.join('') })
}
