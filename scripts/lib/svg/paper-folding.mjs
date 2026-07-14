// paper_folding — hole-punch folding thinking-skills figures (ts3-016).
//
// Stimulus spec: { type:"paper_folding", stimulus:true }
//   draws the 3-step strip: square → folded tall rectangle (crease) → folded
//   rectangle with a punched hole near the top-left.
// Option spec:   { type:"paper_folding", holes:[{x,y}] }
//   draws the unfolded square with holes at normalised (x,y) positions in [0,1].

import { PALETTE, circle, group, line, num, path, rect, svgDocument, text } from './svg-core.mjs'

const SQ = 92

function holeAt(x, y, nx, ny) {
  return circle(x + nx * SQ, y + ny * SQ, 5.5, { fill: PALETTE.ink })
}

function arrow(x, y) {
  return path(
    `M ${num(x)} ${num(y)} L ${num(x + 26)} ${num(y)} ` +
      `M ${num(x + 26)} ${num(y)} L ${num(x + 19)} ${num(y - 5)} ` +
      `M ${num(x + 26)} ${num(y)} L ${num(x + 19)} ${num(y + 5)}`,
    { fill: 'none', stroke: PALETTE.muted, 'stroke-width': 2, 'stroke-linecap': 'round' }
  )
}

export function renderPaperFolding(spec) {
  if (spec.holes) {
    const width = spec.width ?? SQ + 40
    const height = spec.height ?? SQ + 40
    const x = (width - SQ) / 2
    const y = (height - SQ) / 2
    const body = [
      rect(x, y, SQ, SQ, { fill: '#ffffff', stroke: PALETTE.ink, 'stroke-width': 2, rx: 3 }),
      ...spec.holes.map((h) => holeAt(x, y, h.x, h.y)),
    ]
    return svgDocument({ width, height, title: spec.alt_text, body: body.join('') })
  }

  // Horizontal-fold stimulus: the sheet is folded bottom-up (crease along the
  // top edge of the folded piece), then a hole is punched near the top. Kept in
  // its own branch so the default (vertical) stimulus renders byte-identically.
  if (spec.fold === 'horizontal') {
    const gap = 30
    const foldedH = SQ / 2
    const width = spec.width ?? SQ * 3 + gap * 2 + 44
    const height = spec.height ?? SQ + 44
    const body = []
    let x = 20
    const baseY = 26

    // Panel 1: full square.
    body.push(rect(x, baseY, SQ, SQ, { fill: '#ffffff', stroke: PALETTE.ink, 'stroke-width': 2, rx: 3 }))
    body.push(text(x + SQ / 2, baseY + SQ + 18, 'sheet', { anchor: 'middle', size: 10, fill: PALETTE.muted }))
    x += SQ + 12
    body.push(arrow(x, baseY + SQ / 2))
    x += gap

    // Panel 2: folded (half height) sitting on the lower half; dashed crease on top.
    const fy = baseY + SQ - foldedH
    body.push(rect(x, fy, SQ, foldedH, { fill: '#f8fafc', stroke: PALETTE.ink, 'stroke-width': 2, rx: 3 }))
    body.push(line(x, fy, x + SQ, fy, { stroke: PALETTE.accent, 'stroke-width': 2, 'stroke-dasharray': '5 4' }))
    body.push(text(x + SQ / 2, baseY + SQ + 18, 'folded', { anchor: 'middle', size: 10, fill: PALETTE.muted }))
    x += SQ + 12
    body.push(arrow(x, baseY + SQ / 2))
    x += gap

    // Panel 3: folded sheet with a punched hole near the top edge (the crease).
    body.push(rect(x, fy, SQ, foldedH, { fill: '#f8fafc', stroke: PALETTE.ink, 'stroke-width': 2, rx: 3 }))
    body.push(line(x, fy, x + SQ, fy, { stroke: PALETTE.accent, 'stroke-width': 2, 'stroke-dasharray': '5 4' }))
    body.push(circle(x + SQ * 0.28, fy + foldedH * 0.34, 5.5, { fill: PALETTE.ink }))
    body.push(text(x + SQ / 2, baseY + SQ + 18, 'punch', { anchor: 'middle', size: 10, fill: PALETTE.muted }))

    return svgDocument({ width, height, title: spec.alt_text, body: body.join('') })
  }

  // Stimulus: three panels with arrows between them.
  const gap = 34
  const foldedW = SQ / 2
  const width = spec.width ?? SQ + gap + foldedW + gap + foldedW + 44
  const height = spec.height ?? SQ + 44
  const y = 26
  const body = []
  let x = 20

  // Panel 1: full square.
  body.push(rect(x, y, SQ, SQ, { fill: '#ffffff', stroke: PALETTE.ink, 'stroke-width': 2, rx: 3 }))
  body.push(text(x + SQ / 2, y + SQ + 18, 'sheet', { anchor: 'middle', size: 10, fill: PALETTE.muted }))
  x += SQ + 12
  body.push(arrow(x, y + SQ / 2))
  x += gap

  // Panel 2: folded (half width) with a dashed crease on the right edge.
  body.push(rect(x, y, foldedW, SQ, { fill: '#f8fafc', stroke: PALETTE.ink, 'stroke-width': 2, rx: 3 }))
  body.push(line(x + foldedW, y, x + foldedW, y + SQ, { stroke: PALETTE.accent, 'stroke-width': 2, 'stroke-dasharray': '5 4' }))
  body.push(text(x + foldedW / 2, y + SQ + 18, 'folded', { anchor: 'middle', size: 10, fill: PALETTE.muted }))
  x += foldedW + 12
  body.push(arrow(x, y + SQ / 2))
  x += gap

  // Panel 3: folded sheet with a punched hole near the top-left.
  body.push(rect(x, y, foldedW, SQ, { fill: '#f8fafc', stroke: PALETTE.ink, 'stroke-width': 2, rx: 3 }))
  body.push(line(x + foldedW, y, x + foldedW, y + SQ, { stroke: PALETTE.accent, 'stroke-width': 2, 'stroke-dasharray': '5 4' }))
  body.push(circle(x + foldedW * 0.32, y + SQ * 0.2, 5.5, { fill: PALETTE.ink }))
  body.push(text(x + foldedW / 2, y + SQ + 18, 'punch', { anchor: 'middle', size: 10, fill: PALETTE.muted }))

  return svgDocument({ width, height, title: spec.alt_text, body: body.join('') })
}
