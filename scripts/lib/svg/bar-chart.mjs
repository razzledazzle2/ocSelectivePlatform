// bar_chart — a simple vertical column graph with numbered y-axis, gridlines
// and one labelled column per category.
//
// Spec shape:
// {
//   type: "bar_chart",
//   width?, height?,
//   title?, x_label?, y_label?,
//   y_min?(0), y_max, y_step,
//   categories: [{ label, value }],
//   bar_fill?
// }

import { PALETTE, group, line, num, rect, svgDocument, text } from './svg-core.mjs'

const MARGIN = { top: 48, right: 20, bottom: 54, left: 56 }

export function renderBarChart(spec) {
  const width = spec.width ?? 520
  const height = spec.height ?? 400
  const yMin = spec.y_min ?? 0
  const yMax = spec.y_max
  const yStep = spec.y_step ?? Math.max(1, Math.round((yMax - yMin) / 6))
  const categories = spec.categories ?? []

  const plot = {
    left: MARGIN.left,
    top: MARGIN.top,
    width: width - MARGIN.left - MARGIN.right,
    height: height - MARGIN.top - MARGIN.bottom,
  }

  const py = (v) => plot.top + plot.height - ((v - yMin) / (yMax - yMin || 1)) * plot.height
  const body = []

  if (spec.title) {
    body.push(text(width / 2, 24, spec.title, { anchor: 'middle', size: 14, weight: 700, fill: PALETTE.ink }))
  }

  // Horizontal gridlines + y tick labels.
  for (let v = yMin; v <= yMax; v += yStep) {
    body.push(line(plot.left, py(v), plot.left + plot.width, py(v), { stroke: PALETTE.grid, 'stroke-width': 1 }))
    body.push(text(plot.left - 8, py(v), String(v), { anchor: 'end', baseline: 'middle', size: 11, fill: PALETTE.muted }))
  }

  // Axes.
  body.push(line(plot.left, plot.top, plot.left, plot.top + plot.height, { stroke: PALETTE.axis, 'stroke-width': 1.75 }))
  body.push(
    line(plot.left, plot.top + plot.height, plot.left + plot.width, plot.top + plot.height, {
      stroke: PALETTE.axis,
      'stroke-width': 1.75,
    })
  )

  // Columns — evenly spaced, 56% of the slot width.
  const slot = plot.width / (categories.length || 1)
  const barWidth = slot * 0.56
  categories.forEach((cat, index) => {
    const cx = plot.left + slot * index + slot / 2
    const top = py(cat.value)
    const barHeight = plot.top + plot.height - top
    body.push(
      rect(cx - barWidth / 2, top, barWidth, barHeight, {
        fill: spec.bar_fill ?? PALETTE.bar,
        stroke: PALETTE.ink,
        'stroke-width': 1,
        rx: 2,
      })
    )
    body.push(text(cx, py(cat.value) - 6, String(cat.value), { anchor: 'middle', size: 11, weight: 600, fill: PALETTE.ink }))
    body.push(text(cx, plot.top + plot.height + 18, cat.label, { anchor: 'middle', size: 11, fill: PALETTE.muted }))
  })

  // Axis titles.
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
