// symbol_key — code/symbol thinking-skills figures (ts3-013).
//
// Stimulus spec: { type:"symbol_key", key:[{shape,symbol}], message:[shape,...] }
//   draws a bordered key box (shape → symbol per row) and a message row of shapes.
// Option spec:   { type:"symbol_key", symbols:[symbol,...] }
//   draws a row of decoded symbols.
//
// shape ∈ circle|square|triangle ; symbol ∈ plus|star|dot

import { PALETTE, group, line, num, path, rect, svgDocument, text } from './svg-core.mjs'
import { drawGlyph } from './shapes.mjs'

const CELL = 52

function rightArrow(x, y, len = 26) {
  return path(
    `M ${num(x)} ${num(y)} L ${num(x + len)} ${num(y)} ` +
      `M ${num(x + len)} ${num(y)} L ${num(x + len - 7)} ${num(y - 5)} ` +
      `M ${num(x + len)} ${num(y)} L ${num(x + len - 7)} ${num(y + 5)}`,
    { fill: 'none', stroke: PALETTE.muted, 'stroke-width': 2, 'stroke-linecap': 'round' }
  )
}

function glyphAt(cx, cy, shape) {
  return drawGlyph(cx, cy, CELL, { shape, fill: shape === 'dot' || shape === 'star' ? PALETTE.ink : 'none' })
}

function renderKey(keyRows, x, y) {
  const rowH = 46
  const boxW = 150
  const boxH = keyRows.length * rowH + 16
  const parts = [
    rect(x, y, boxW, boxH, { fill: '#ffffff', stroke: PALETTE.grid, 'stroke-width': 1.5, rx: 8 }),
  ]
  keyRows.forEach((row, i) => {
    const cy = y + 16 + i * rowH + rowH / 2 - 8
    parts.push(glyphAt(x + 34, cy, row.shape))
    parts.push(rightArrow(x + 62, cy, 24))
    parts.push(glyphAt(x + 116, cy, row.symbol))
  })
  return { markup: group(parts, {}), boxW, boxH }
}

function renderRow(items, mapFill, x, y) {
  const parts = []
  items.forEach((item, i) => {
    parts.push(glyphAt(x + i * CELL + CELL / 2, y, item))
  })
  return group(parts, {})
}

export function renderSymbolKey(spec) {
  const width = spec.width ?? 360
  const body = []
  let cursorY = 24

  if (spec.title) {
    body.push(text(width / 2, 18, spec.title, { anchor: 'middle', size: 13, weight: 700, fill: PALETTE.ink }))
    cursorY = 34
  }

  if (spec.symbols) {
    // Option: a single row of decoded symbols, centred.
    const rowW = spec.symbols.length * CELL
    const startX = (width - rowW) / 2
    const height = spec.height ?? CELL + 28
    body.push(renderRow(spec.symbols, true, startX, height / 2))
    return svgDocument({ width, height, title: spec.alt_text, body: body.join('') })
  }

  // Stimulus: key box + a labelled message row.
  const key = renderKey(spec.key ?? [], (width - 150) / 2, cursorY)
  body.push(key.markup)
  let y = cursorY + key.boxH + 30
  body.push(text(width / 2, y - 12, 'Message', { anchor: 'middle', size: 11, weight: 600, fill: PALETTE.muted }))
  const msg = spec.message ?? []
  const rowW = msg.length * CELL
  body.push(renderRow(msg, false, (width - rowW) / 2, y + 18))
  const height = spec.height ?? y + 18 + CELL

  return svgDocument({ width, height, title: spec.alt_text, body: body.join('') })
}
