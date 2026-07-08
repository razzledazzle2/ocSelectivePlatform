// spatial_assembly — flat puzzle-piece figures (ts3-018).
//
// Stimulus spec: { type:"spatial_assembly", stimulus:true }
//   draws the target: one complete square to be made from two pieces.
// Option spec:   { type:"spatial_assembly", pieces:[ piece, piece ] }
//   a piece is { rect:[x,y,w,h] } or { points:[[x,y],...] } in a shared local
//   coordinate space; pieces are drawn with light fills so the pair is clear.

import { PALETTE, group, polygon, rect, svgDocument, text } from './svg-core.mjs'

const FILLS = ['#dbeafe', '#bbf7d0']

function drawPiece(piece, fill) {
  if (piece.rect) {
    const [x, y, w, h] = piece.rect
    return rect(x, y, w, h, { fill, stroke: PALETTE.ink, 'stroke-width': 2, 'stroke-linejoin': 'round' })
  }
  return polygon(piece.points, { fill, stroke: PALETTE.ink, 'stroke-width': 2, 'stroke-linejoin': 'round' })
}

export function renderSpatialAssembly(spec) {
  if (spec.stimulus) {
    const width = spec.width ?? 200
    const height = spec.height ?? 180
    const s = 90
    const body = [
      rect((width - s) / 2, 24, s, s, {
        fill: PALETTE.fillSoft,
        stroke: PALETTE.accent,
        'stroke-width': 2,
        'stroke-dasharray': '7 5',
        rx: 3,
      }),
      text(width / 2, height - 14, 'Fit two pieces to make this square', {
        anchor: 'middle',
        size: 10.5,
        fill: PALETTE.muted,
      }),
    ]
    return svgDocument({ width, height, title: spec.alt_text, body: body.join('') })
  }

  const width = spec.width ?? 220
  const height = spec.height ?? 120
  const body = (spec.pieces ?? []).map((piece, i) => drawPiece(piece, FILLS[i % FILLS.length]))
  return svgDocument({ width, height, title: spec.alt_text, body: body.join('') })
}
