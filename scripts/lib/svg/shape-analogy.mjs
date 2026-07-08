// shape_analogy — "A is to B as C is to ?" figures (ts3-012).
//
// Stimulus spec: { type:"shape_analogy", rows:[ { from, to }, ... ] }
//   each row draws  from-figure  →  to-figure  (to may be { question:true }).
// Option spec:   { type:"shape_analogy", figure: <figure> }
//
// A <figure> is one of:
//   { shape, nested?:{ shape, scale? } }   a shape, optionally with a smaller shape inside
//   { pair:[ figureA, figureB ] }          two shapes side by side
//   { question:true }                      a dashed "?" box

import { PALETTE, group, num, path, rect, svgDocument, text } from './svg-core.mjs'
import { drawGlyph } from './shapes.mjs'
import { cellBox } from './shapes.mjs'

const CELL = 78

function drawFigure(cx, cy, fig) {
  if (!fig || fig.question) {
    return cellBox(cx - CELL / 2, cy - CELL / 2, CELL, { question: true })
  }
  if (fig.pair) {
    const gap = CELL * 0.52
    return group(
      [drawGlyph(cx - gap / 2, cy, CELL * 0.8, fig.pair[0]), drawGlyph(cx + gap / 2, cy, CELL * 0.8, fig.pair[1])],
      {}
    )
  }
  const parts = [drawGlyph(cx, cy, CELL, { shape: fig.shape, fill: 'none' })]
  if (fig.nested) {
    parts.push(
      drawGlyph(cx, cy, CELL, {
        shape: fig.nested.shape,
        scale: fig.nested.scale ?? 0.5,
        fill: fig.nested.shape === 'dot' ? PALETTE.ink : 'none',
      })
    )
  }
  return group(parts, {})
}

function arrow(x, y, len = 34) {
  return path(
    `M ${num(x)} ${num(y)} L ${num(x + len)} ${num(y)} ` +
      `M ${num(x + len)} ${num(y)} L ${num(x + len - 8)} ${num(y - 6)} ` +
      `M ${num(x + len)} ${num(y)} L ${num(x + len - 8)} ${num(y + 6)}`,
    { fill: 'none', stroke: PALETTE.muted, 'stroke-width': 2, 'stroke-linecap': 'round' }
  )
}

export function renderShapeAnalogy(spec) {
  if (spec.figure) {
    const width = spec.width ?? CELL + 28
    const height = spec.height ?? CELL + 28
    return svgDocument({
      width,
      height,
      title: spec.alt_text,
      body: drawFigure(width / 2, height / 2, spec.figure),
    })
  }

  const rows = spec.rows ?? []
  const arrowLen = 40
  const gap = 34
  const rowW = CELL + gap + arrowLen + gap + CELL
  const width = spec.width ?? rowW + 40
  const rowH = CELL + 24
  const height = spec.height ?? rows.length * rowH + 24

  const body = []
  const startX = (width - rowW) / 2
  rows.forEach((row, i) => {
    const cy = 24 + i * rowH + CELL / 2
    const fromCx = startX + CELL / 2
    const toCx = startX + CELL + gap + arrowLen + gap + CELL / 2
    body.push(drawFigure(fromCx, cy, row.from))
    body.push(arrow(startX + CELL + gap, cy, arrowLen))
    body.push(drawFigure(toCx, cy, row.to))
  })
  return svgDocument({ width, height, title: spec.alt_text, body: body.join('') })
}
