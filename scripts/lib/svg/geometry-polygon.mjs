// geometry_polygon — a single closed polygon drawn "not to scale" with labelled
// side lengths. For composite-area / perimeter / rectilinear-shape questions
// (e.g. L-shaped plots) where the maths is about labelled sides, not grid
// coordinates. Points are shape coordinates (any units); the shape is scaled to
// fit the viewport, so relative — not absolute — proportions are what matter.
//
// Spec shape:
// {
//   type: "geometry_polygon",
//   width?, height?, title?, caption?, fill?,
//   points: [{ x, y }],                 // in order around the polygon
//   edge_labels: [{ from, to, label }]  // from/to are point indices
// }
//
// NOTE: when a `shapes` array is present this is treated as a coordinate_grid
// spec instead (see render.mjs) — this generator is the standalone labelled form.

import { PALETTE, group, num, polygon as polygonEl, svgDocument, text } from './svg-core.mjs'

const MARGIN = { top: 44, right: 56, bottom: 48, left: 56 }

export function renderGeometryPolygon(spec) {
  const width = spec.width ?? 460
  const height = spec.height ?? 400
  const pts = spec.points ?? []
  if (pts.length < 3) {
    throw new Error('geometry_polygon needs at least 3 points.')
  }

  const xs = pts.map((p) => p.x)
  const ys = pts.map((p) => p.y)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  const plotW = width - MARGIN.left - MARGIN.right
  const plotH = height - MARGIN.top - MARGIN.bottom
  const scale = Math.min(plotW / (maxX - minX || 1), plotH / (maxY - minY || 1))
  const drawnW = (maxX - minX) * scale
  const drawnH = (maxY - minY) * scale
  const offX = MARGIN.left + (plotW - drawnW) / 2
  const offY = MARGIN.top + (plotH - drawnH) / 2

  // Shape space → px. y flips so larger y is higher on screen.
  const px = (x) => offX + (x - minX) * scale
  const py = (y) => offY + (maxY - y) * scale

  const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length
  const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length

  const body = []
  if (spec.title) {
    body.push(text(width / 2, 24, spec.title, { anchor: 'middle', size: 14, weight: 700, fill: PALETTE.ink }))
  }

  body.push(
    polygonEl(pts.map((p) => [px(p.x), py(p.y)]), {
      fill: spec.fill ?? 'none',
      stroke: PALETTE.ink,
      'stroke-width': 2,
      'stroke-linejoin': 'round',
    })
  )

  // Edge length labels, nudged outward from the centroid so they sit outside the shape.
  for (const edge of spec.edge_labels ?? []) {
    const a = pts[edge.from]
    const b = pts[edge.to]
    if (!a || !b) continue
    const midX = (a.x + b.x) / 2
    const midY = (a.y + b.y) / 2
    const dx = midX - cx
    const dy = midY - cy
    const mag = Math.hypot(dx, dy) || 1
    const lx = px(midX) + (dx / mag) * 16
    const ly = py(midY) - (dy / mag) * 16
    body.push(
      text(lx, ly, edge.label, { anchor: 'middle', baseline: 'middle', size: 12, weight: 600, fill: PALETTE.ink })
    )
  }

  if (spec.caption) {
    body.push(
      group([text(width / 2, height - 14, spec.caption, { anchor: 'middle', size: 11, fill: PALETTE.muted })], {})
    )
  }

  return svgDocument({ width, height, title: spec.title ?? spec.alt_text, body: body.join('') })
}
