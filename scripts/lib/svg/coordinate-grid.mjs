// coordinate_grid — a numbered Cartesian grid with polygons, points, segments,
// mirror lines and translation arrows drawn in data coordinates.
//
// Spec shape:
// {
//   type: "coordinate_grid",
//   width, height,               // px (optional; sensible defaults)
//   x_min, x_max, y_min, y_max,  // data range (integers)
//   title?, x_label?, y_label?,
//   shapes: [
//     { type:"polygon", label?, points:[{label?,x,y}], right_angle_at?, fill?, closed? },
//     { type:"point", x, y, label? },
//     { type:"segment", from:{x,y}, to:{x,y}, style?, label? },
//     { type:"mirror_line", axis:"x"|"y", at, label?, style? },
//     { type:"translation_arrow", from:{x,y}, dx, dy, label?, style? },
//   ]
// }

import {
  PALETTE,
  circle,
  group,
  line,
  num,
  path,
  polygon as polygonEl,
  svgDocument,
  text,
} from './svg-core.mjs'

const MARGIN = { top: 44, right: 24, bottom: 40, left: 44 }

function buildProjector(spec, plot) {
  const { x_min, x_max, y_min, y_max } = spec
  const spanX = x_max - x_min || 1
  const spanY = y_max - y_min || 1
  // Data (x,y) → SVG px. y is flipped so larger y is higher on screen.
  const px = (x) => plot.left + ((x - x_min) / spanX) * plot.width
  const py = (y) => plot.top + plot.height - ((y - y_min) / spanY) * plot.height
  return { px, py }
}

function drawGridAndAxes(spec, plot, project) {
  const { px, py } = project
  const parts = []

  // Gridlines on every integer step.
  for (let x = spec.x_min; x <= spec.x_max; x += 1) {
    parts.push(line(px(x), plot.top, px(x), plot.top + plot.height, { stroke: PALETTE.grid, 'stroke-width': 1 }))
    parts.push(text(px(x), plot.top + plot.height + 16, String(x), { anchor: 'middle', size: 11, fill: PALETTE.muted }))
  }
  for (let y = spec.y_min; y <= spec.y_max; y += 1) {
    parts.push(line(plot.left, py(y), plot.left + plot.width, py(y), { stroke: PALETTE.grid, 'stroke-width': 1 }))
    parts.push(text(plot.left - 8, py(y), String(y), { anchor: 'end', baseline: 'middle', size: 11, fill: PALETTE.muted }))
  }

  // Bold axes if the origin (or the min edge) is in range.
  const axisX = spec.y_min <= 0 && spec.y_max >= 0 ? py(0) : plot.top + plot.height
  const axisY = spec.x_min <= 0 && spec.x_max >= 0 ? px(0) : plot.left
  parts.push(line(plot.left, axisX, plot.left + plot.width, axisX, { stroke: PALETTE.axis, 'stroke-width': 1.75 }))
  parts.push(line(axisY, plot.top, axisY, plot.top + plot.height, { stroke: PALETTE.axis, 'stroke-width': 1.75 }))

  return parts.join('')
}

function drawPolygon(shape, project) {
  const { px, py } = project
  const pts = shape.points.map((p) => [px(p.x), py(p.y)])
  const parts = []

  parts.push(
    polygonEl(pts, {
      fill: shape.fill ?? 'none',
      stroke: shape.stroke ?? PALETTE.ink,
      'stroke-width': 2,
      'stroke-linejoin': 'round',
    })
  )

  // Right-angle marker: a small square at the named vertex, between its two edges.
  if (shape.right_angle_at) {
    const idx = shape.points.findIndex((p) => p.label === shape.right_angle_at)
    if (idx !== -1) {
      const corner = shape.points[idx]
      const a = shape.points[(idx - 1 + shape.points.length) % shape.points.length]
      const b = shape.points[(idx + 1) % shape.points.length]
      const marker = rightAngleMarker(corner, a, b, project)
      if (marker) parts.push(marker)
    }
  }

  // Vertex dots + labels, nudged away from the shape centroid so they don't overlap edges.
  const cx = shape.points.reduce((s, p) => s + p.x, 0) / shape.points.length
  const cy = shape.points.reduce((s, p) => s + p.y, 0) / shape.points.length
  for (const p of shape.points) {
    parts.push(circle(px(p.x), py(p.y), 3.5, { fill: PALETTE.ink }))
    if (p.label) {
      const dx = p.x - cx
      const dy = p.y - cy
      const mag = Math.hypot(dx, dy) || 1
      const lx = px(p.x) + (dx / mag) * 16
      const ly = py(p.y) - (dy / mag) * 16
      parts.push(
        text(lx, ly, p.label, { anchor: 'middle', baseline: 'middle', size: 13, weight: 600, fill: PALETTE.ink })
      )
    }
  }

  return group(parts, {})
}

function rightAngleMarker(corner, a, b, project) {
  const { px, py } = project
  // Unit vectors (in px space) along the two edges leaving the corner.
  const toPx = (p) => [px(p.x), py(p.y)]
  const [cxp, cyp] = toPx(corner)
  const [axp, ayp] = toPx(a)
  const [bxp, byp] = toPx(b)
  const u = unit(axp - cxp, ayp - cyp)
  const v = unit(bxp - cxp, byp - cyp)
  if (!u || !v) return null
  const s = 12
  const p1 = [cxp + u[0] * s, cyp + u[1] * s]
  const p2 = [cxp + u[0] * s + v[0] * s, cyp + u[1] * s + v[1] * s]
  const p3 = [cxp + v[0] * s, cyp + v[1] * s]
  return path(`M ${num(p1[0])} ${num(p1[1])} L ${num(p2[0])} ${num(p2[1])} L ${num(p3[0])} ${num(p3[1])}`, {
    fill: 'none',
    stroke: PALETTE.ink,
    'stroke-width': 1.5,
  })
}

function unit(dx, dy) {
  const m = Math.hypot(dx, dy)
  return m === 0 ? null : [dx / m, dy / m]
}

function drawPoint(shape, project) {
  const { px, py } = project
  const parts = [circle(px(shape.x), py(shape.y), 4, { fill: PALETTE.ink })]
  if (shape.label) {
    parts.push(
      text(px(shape.x) + 8, py(shape.y) - 8, shape.label, { anchor: 'start', size: 13, weight: 600, fill: PALETTE.ink })
    )
  }
  return group(parts, {})
}

function drawSegment(shape, project) {
  const { px, py } = project
  const dashed = shape.style === 'dashed'
  return line(px(shape.from.x), py(shape.from.y), px(shape.to.x), py(shape.to.y), {
    stroke: shape.stroke ?? PALETTE.ink,
    'stroke-width': 2,
    'stroke-dasharray': dashed ? '6 5' : null,
  })
}

function drawMirrorLine(shape, spec, project) {
  const { px, py } = project
  const parts = []
  if (shape.axis === 'x') {
    const x = px(shape.at)
    parts.push(line(x, project.py(spec.y_max), x, project.py(spec.y_min), {
      stroke: PALETTE.accent,
      'stroke-width': 2,
      'stroke-dasharray': '7 5',
    }))
    if (shape.label) parts.push(text(x, project.py(spec.y_max) - 8, shape.label, { anchor: 'middle', size: 12, weight: 600, fill: PALETTE.accent }))
  } else {
    const y = py(shape.at)
    parts.push(line(project.px(spec.x_min), y, project.px(spec.x_max), y, {
      stroke: PALETTE.accent,
      'stroke-width': 2,
      'stroke-dasharray': '7 5',
    }))
    if (shape.label) parts.push(text(project.px(spec.x_max), y - 6, shape.label, { anchor: 'end', size: 12, weight: 600, fill: PALETTE.accent }))
  }
  return group(parts, {})
}

function drawTranslationArrow(shape, project) {
  const { px, py } = project
  const x1 = px(shape.from.x)
  const y1 = py(shape.from.y)
  const x2 = px(shape.from.x + shape.dx)
  const y2 = py(shape.from.y + shape.dy)
  const dashed = shape.style !== 'solid'
  const parts = []
  parts.push(
    line(x1, y1, x2, y2, {
      stroke: PALETTE.accent,
      'stroke-width': 2.25,
      'stroke-dasharray': dashed ? '7 5' : null,
      'marker-end': 'url(#arrowhead)',
    })
  )
  if (shape.label) {
    const mx = (x1 + x2) / 2
    const my = (y1 + y2) / 2
    parts.push(
      text(mx, my - 8, shape.label, { anchor: 'middle', size: 12, weight: 600, fill: PALETTE.accent })
    )
  }
  return group(parts, {})
}

const SHAPE_DRAWERS = {
  polygon: (shape, spec, project) => drawPolygon(shape, project),
  point: (shape, spec, project) => drawPoint(shape, project),
  segment: (shape, spec, project) => drawSegment(shape, project),
  mirror_line: (shape, spec, project) => drawMirrorLine(shape, spec, project),
  translation_arrow: (shape, spec, project) => drawTranslationArrow(shape, project),
  // geometry_polygon / translation_arrow are also exposed as first-class spec
  // types (see render.mjs) but reuse the same drawers here.
  geometry_polygon: (shape, spec, project) => drawPolygon(shape, project),
}

export function renderCoordinateGrid(spec) {
  const width = spec.width ?? 440
  const height = spec.height ?? 440
  const plot = {
    left: MARGIN.left,
    top: MARGIN.top,
    width: width - MARGIN.left - MARGIN.right,
    height: height - MARGIN.top - MARGIN.bottom,
  }
  const project = buildProjector(spec, plot)

  const body = []
  // Arrowhead marker for translation arrows.
  body.push(
    `<defs><marker id="arrowhead" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="${PALETTE.accent}" /></marker></defs>`
  )
  if (spec.title) {
    body.push(text(width / 2, 22, spec.title, { anchor: 'middle', size: 14, weight: 700, fill: PALETTE.ink }))
  }
  body.push(drawGridAndAxes(spec, plot, project))

  for (const shape of spec.shapes ?? []) {
    const drawer = SHAPE_DRAWERS[shape.type]
    if (!drawer) {
      throw new Error(`coordinate_grid: unsupported shape type "${shape.type}"`)
    }
    body.push(drawer(shape, spec, project))
  }

  return svgDocument({ width, height, title: spec.title ?? spec.alt_text, body: body.join('') })
}
