// cube_net — flat hexomino nets of a cube, drawn on a unit grid.
//
// Used for "which net folds into a cube?" thinking-skills items. A net is a set
// of unit squares placed at [col, row] grid positions (row increases downward).
// The generator only draws the arrangement deterministically; whether a given
// arrangement actually folds into a cube is a property of the authored spec and
// is verified when the question is written (there are exactly 11 valid cube nets).
//
// Spec shape:
//   { type: "cube_net",
//     squares: [[col, row], ...],   // the six (or other count) unit faces
//     labels?: { "col,row": "A" },  // optional per-face label
//     cell?: number,                // unit size in px (default 34)
//     width?, height?, title? }

import { PALETTE, group, rect, svgDocument, text } from './svg-core.mjs'

const DEFAULT_CELL = 34
const MARGIN = 16

export function renderCubeNet(spec) {
  const squares = spec.squares ?? []
  if (squares.length === 0) {
    throw new Error('cube_net: spec.squares must list at least one [col,row] face.')
  }
  const cell = spec.cell ?? DEFAULT_CELL
  const labels = spec.labels ?? {}

  const cols = Math.max(...squares.map(([c]) => c)) + 1
  const rows = Math.max(...squares.map(([, r]) => r)) + 1
  const titleHeight = spec.title ? 26 : 0

  const gridW = cols * cell
  const gridH = rows * cell
  const width = spec.width ?? gridW + MARGIN * 2
  const height = spec.height ?? gridH + MARGIN * 2 + titleHeight

  // Centre the net within the drawing box.
  const ox = (width - gridW) / 2
  const oy = MARGIN + titleHeight + (height - MARGIN - titleHeight - gridH) / 2

  const body = []
  if (spec.title) {
    body.push(text(width / 2, 18, spec.title, { anchor: 'middle', size: 13, weight: 700, fill: PALETTE.ink }))
  }

  const faces = squares.map(([c, r]) => {
    const x = ox + c * cell
    const y = oy + r * cell
    const parts = [
      rect(x, y, cell, cell, {
        fill: '#e5e7eb',
        stroke: PALETTE.ink,
        'stroke-width': 2,
        'stroke-linejoin': 'round',
      }),
    ]
    const label = labels[`${c},${r}`]
    if (label) {
      parts.push(
        text(x + cell / 2, y + cell / 2, label, {
          anchor: 'middle',
          baseline: 'middle',
          size: cell * 0.42,
          weight: 600,
          fill: PALETTE.muted,
        })
      )
    }
    return parts.join('')
  })

  body.push(group(faces, {}))
  return svgDocument({ width, height, title: spec.title ?? spec.alt_text, body: body.join('') })
}
