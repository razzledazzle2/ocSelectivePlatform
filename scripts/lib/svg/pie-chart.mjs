// pie_chart — a circle split into labelled sectors sized by fraction or degrees.
//
// Spec shape:
// {
//   type: "pie_chart",
//   width?, height?, title?,
//   sectors: [{ label, fraction }] | [{ label, degrees }],
//   // optional per-sector "fill"; defaults cycle a soft palette
// }

import { PALETTE, num, path, svgDocument, text } from './svg-core.mjs'

const SECTOR_FILLS = ['#dbeafe', '#bbf7d0', '#fed7aa', '#e9d5ff', '#fecaca', '#fef08a']

function sectorAngles(sectors) {
  const total = sectors.reduce(
    (sum, s) => sum + (s.degrees != null ? s.degrees : (s.fraction ?? 0) * 360),
    0
  )
  // Normalise to 360 so slightly-off fractions still close the circle.
  const scale = total > 0 ? 360 / total : 1
  let cursor = -90 // start at 12 o'clock
  return sectors.map((s) => {
    const sweep = (s.degrees != null ? s.degrees : (s.fraction ?? 0) * 360) * scale
    const start = cursor
    cursor += sweep
    return { ...s, start, end: cursor, mid: start + sweep / 2 }
  })
}

function polar(cx, cy, r, deg) {
  const rad = (deg * Math.PI) / 180
  return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)]
}

export function renderPieChart(spec) {
  const width = spec.width ?? 460
  const height = spec.height ?? 420
  const title = spec.title
  const cx = width / 2
  const cy = (title ? 34 : 10) + (height - (title ? 34 : 10)) / 2
  const r = Math.min(width, height - (title ? 40 : 12)) / 2 - 54

  const body = []
  if (title) {
    body.push(text(width / 2, 24, title, { anchor: 'middle', size: 14, weight: 700, fill: PALETTE.ink }))
  }

  const sectors = sectorAngles(spec.sectors ?? [])
  sectors.forEach((sector, index) => {
    const [x1, y1] = polar(cx, cy, r, sector.start)
    const [x2, y2] = polar(cx, cy, r, sector.end)
    const largeArc = sector.end - sector.start > 180 ? 1 : 0
    const d = `M ${num(cx)} ${num(cy)} L ${num(x1)} ${num(y1)} A ${num(r)} ${num(r)} 0 ${largeArc} 1 ${num(x2)} ${num(y2)} Z`
    body.push(path(d, { fill: sector.fill ?? SECTOR_FILLS[index % SECTOR_FILLS.length], stroke: PALETTE.ink, 'stroke-width': 1.75 }))

    // Label just outside the arc at the sector's mid-angle.
    const [lx, ly] = polar(cx, cy, r + 22, sector.mid)
    const anchor = Math.cos((sector.mid * Math.PI) / 180) > 0.2 ? 'start' : Math.cos((sector.mid * Math.PI) / 180) < -0.2 ? 'end' : 'middle'
    body.push(text(lx, ly, sector.label, { anchor, baseline: 'middle', size: 12, weight: 600, fill: PALETTE.ink }))
  })

  return svgDocument({ width, height, title: spec.title ?? spec.alt_text, body: body.join('') })
}
