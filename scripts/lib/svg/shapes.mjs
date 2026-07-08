// Small library of simple glyphs used by the thinking-skills generators
// (abstract sequences, matrix patterns). Every glyph is drawn centred at
// (cx, cy) within a box of side `size`, so cells can be laid out on a grid.

import { PALETTE, circle, group, line, num, path, polygon, rect, text } from './svg-core.mjs'

/**
 * Draws one glyph. `glyph` shape:
 *   { shape: "circle"|"square"|"triangle"|"diamond"|"dot"|"plus"|"star"|"arrow"|"none",
 *     fill?, stroke?, rotation?, count? }
 * `count` (for shape:"dot") draws that many dots in a small cluster.
 */
export function drawGlyph(cx, cy, size, glyph) {
  if (!glyph || glyph.shape === 'none') return ''
  const r = size * 0.34 * (glyph.scale ?? 1)
  const fill = glyph.fill ?? 'none'
  const stroke = glyph.stroke ?? PALETTE.ink
  const strokeWidth = 2
  const common = { fill, stroke, 'stroke-width': strokeWidth, 'stroke-linejoin': 'round' }
  const rotate = glyph.rotation ? `rotate(${glyph.rotation} ${num(cx)} ${num(cy)})` : null

  let el = ''
  switch (glyph.shape) {
    case 'circle':
      el = circle(cx, cy, r, common)
      break
    case 'square':
      el = rect(cx - r, cy - r, r * 2, r * 2, { ...common, rx: 2 })
      break
    case 'triangle':
      el = polygon([[cx, cy - r], [cx + r, cy + r], [cx - r, cy + r]], common)
      break
    case 'diamond':
      el = polygon([[cx, cy - r], [cx + r, cy], [cx, cy + r], [cx - r, cy]], common)
      break
    case 'dot':
      return dotCluster(cx, cy, r, glyph.count ?? 1, glyph.fill ?? PALETTE.ink)
    case 'plus':
      el = group([
        line(cx - r, cy, cx + r, cy, { stroke, 'stroke-width': strokeWidth + 0.5 }),
        line(cx, cy - r, cx, cy + r, { stroke, 'stroke-width': strokeWidth + 0.5 }),
      ], {})
      break
    case 'star':
      el = polygon(starPoints(cx, cy, r, r * 0.42, 5), { ...common, fill: glyph.fill ?? PALETTE.ink })
      break
    case 'arrow':
      el = path(
        `M ${num(cx - r)} ${num(cy)} L ${num(cx + r * 0.3)} ${num(cy)} ` +
          `M ${num(cx + r)} ${num(cy)} L ${num(cx + r * 0.2)} ${num(cy - r * 0.6)} ` +
          `M ${num(cx + r)} ${num(cy)} L ${num(cx + r * 0.2)} ${num(cy + r * 0.6)}`,
        { fill: 'none', stroke, 'stroke-width': strokeWidth + 0.5, 'stroke-linecap': 'round' }
      )
      break
    default:
      throw new Error(`drawGlyph: unknown shape "${glyph.shape}"`)
  }

  return rotate ? group([el], { transform: rotate }) : el
}

function dotCluster(cx, cy, r, count, fill) {
  const positions = {
    1: [[0, 0]],
    2: [[-0.4, 0], [0.4, 0]],
    3: [[0, -0.45], [-0.45, 0.35], [0.45, 0.35]],
    4: [[-0.4, -0.4], [0.4, -0.4], [-0.4, 0.4], [0.4, 0.4]],
    5: [[0, 0], [-0.45, -0.45], [0.45, -0.45], [-0.45, 0.45], [0.45, 0.45]],
  }
  const layout = positions[count] ?? positions[1]
  return layout.map(([dx, dy]) => circle(cx + dx * r, cy + dy * r, r * 0.24, { fill })).join('')
}

function starPoints(cx, cy, outer, inner, spikes) {
  const points = []
  for (let i = 0; i < spikes * 2; i += 1) {
    const radius = i % 2 === 0 ? outer : inner
    const angle = (Math.PI / spikes) * i - Math.PI / 2
    points.push([cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius])
  }
  return points
}

/** A bordered cell with an optional "?" placeholder (for the missing item). */
export function cellBox(x, y, size, { question = false } = {}) {
  const parts = [
    rect(x, y, size, size, {
      fill: question ? PALETTE.fillSoft : '#ffffff',
      stroke: question ? PALETTE.accent : PALETTE.grid,
      'stroke-width': question ? 2 : 1.5,
      'stroke-dasharray': question ? '6 4' : null,
      rx: 6,
    }),
  ]
  if (question) {
    parts.push(text(x + size / 2, y + size / 2, '?', { anchor: 'middle', baseline: 'middle', size: size * 0.42, weight: 700, fill: PALETTE.accent }))
  }
  return parts.join('')
}
