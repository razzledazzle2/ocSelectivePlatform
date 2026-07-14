// line_chart — a single-series line graph with numbered y-axis, gridlines,
// labelled x-points and a solid dot at each plotted value.
//
// Spec shape:
// {
//   type: "line_chart",
//   width?, height?,
//   title?, x_label?, y_label?,
//   y_min?(0), y_max, y_step,
//   points: [{ label, value }],
//   stroke?
// }

import { PALETTE, circle, line, num, polyline, svgDocument, text } from './svg-core.mjs'

const MARGIN = { top: 48, right: 24, bottom: 54, left: 56 }

export function renderLineChart(spec) {
  const width = spec.width ?? 560
  const height = spec.height ?? 400
  const yMin = spec.y_min ?? 0
  const yMax = spec.y_max
  const yStep = spec.y_step ?? Math.max(1, Math.round((yMax - yMin) / 6))
  const points = spec.points ?? []

  const plot = {
    left: MARGIN.left,
    top: MARGIN.top,
    width: width - MARGIN.left - MARGIN.right,
    height: height - MARGIN.top - MARGIN.bottom,
  }

  const py = (v) => plot.top + plot.height - ((v - yMin) / (yMax - yMin || 1)) * plot.height
  const stepX = plot.width / Math.max(1, points.length - 1)
  const pxAt = (index) => plot.left + stepX * index

  const body = []
  if (spec.title) {
    body.push(text(width / 2, 24, spec.title, { anchor: 'middle', size: 14, weight: 700, fill: PALETTE.ink }))
  }

  for (let v = yMin; v <= yMax; v += yStep) {
    body.push(line(plot.left, py(v), plot.left + plot.width, py(v), { stroke: PALETTE.grid, 'stroke-width': 1 }))
    body.push(text(plot.left - 8, py(v), String(v), { anchor: 'end', baseline: 'middle', size: 11, fill: PALETTE.muted }))
  }

  body.push(line(plot.left, plot.top, plot.left, plot.top + plot.height, { stroke: PALETTE.axis, 'stroke-width': 1.75 }))
  body.push(
    line(plot.left, plot.top + plot.height, plot.left + plot.width, plot.top + plot.height, {
      stroke: PALETTE.axis,
      'stroke-width': 1.75,
    })
  )

  // x labels.
  points.forEach((point, index) => {
    body.push(text(pxAt(index), plot.top + plot.height + 18, point.label, { anchor: 'middle', size: 11, fill: PALETTE.muted }))
  })

  // The line itself, then dots + value labels on top.
  const linePoints = points.map((point, index) => [pxAt(index), py(point.value)])
  body.push(polyline(linePoints, { fill: 'none', stroke: spec.stroke ?? PALETTE.accent, 'stroke-width': 2.25, 'stroke-linejoin': 'round' }))
  points.forEach((point, index) => {
    body.push(circle(pxAt(index), py(point.value), 3.75, { fill: spec.stroke ?? PALETTE.accent }))
    body.push(text(pxAt(index), py(point.value) - 9, String(point.value), { anchor: 'middle', size: 10.5, weight: 600, fill: PALETTE.ink }))
  })

  if (spec.y_label) {
    body.push(
      text(16, plot.top + plot.height / 2, spec.y_label, {
        anchor: 'middle',
        size: 12,
        fill: PALETTE.muted,
        transform: `rotate(-90 16 ${num(plot.top + plot.height / 2)})`,
      })
    )
  }
  if (spec.x_label) {
    body.push(text(plot.left + plot.width / 2, height - 12, spec.x_label, { anchor: 'middle', size: 12, fill: PALETTE.muted }))
  }

  return svgDocument({ width, height, title: spec.title ?? spec.alt_text, body: body.join('') })
}
