// figure_transform — shared renderer for rotation (ts3-014) and reflection
// (ts3-015). Draws a named figure around the origin, then applies a rotation or
// reflection. The same figure + transform vocabulary powers both the stimulus
// (original, with a hint or mirror line) and the four option images.
//
// Spec:
//   { type:"rotation"|"reflection", figure:"flag"|"block_letter_F",
//     transform?:{ rotate:deg } | { reflect:"vertical"|"horizontal" },
//     stimulus?:true, mirror?:"vertical", rotation_hint?:"90° clockwise" }

import { PALETTE, group, line, num, path, rect, svgDocument, text } from './svg-core.mjs'

// Each figure returns markup drawn around the origin (0,0).
const FIGURES = {
  // Upright flagpole with a right-pointing swallowtail pennant (V-notch at the fly).
  flag() {
    const pole = rect(-3.5, -46, 7, 92, { fill: PALETTE.ink })
    const pennant =
      path(
        `M 3.5 -46 L 42 -43 L 31 -33 L 42 -23 L 3.5 -20 Z`,
        { fill: '#ffffff', stroke: PALETTE.ink, 'stroke-width': 2, 'stroke-linejoin': 'round' }
      )
    return group([pole, pennant], {})
  },
  // Block capital F: spine left, full-width top arm, shorter middle arm.
  block_letter_F() {
    return group(
      [
        rect(-22, -38, 13, 76, { fill: PALETTE.ink }), // spine
        rect(-22, -38, 42, 13, { fill: PALETTE.ink }), // top arm
        rect(-22, -6, 30, 12, { fill: PALETTE.ink }), // middle arm
      ],
      {}
    )
  },
  // Block capital L: spine left, foot arm to the right (chiral — mirrors to a
  // reversed L). Good for reflection items where the flip is unmistakable.
  block_letter_L() {
    return group(
      [
        rect(-20, -38, 13, 76, { fill: PALETTE.ink }), // spine
        rect(-20, 25, 40, 13, { fill: PALETTE.ink }), // foot
      ],
      {}
    )
  },
  // Block capital P: spine left with a bowl on the upper-right (chiral).
  block_letter_P() {
    return group(
      [
        rect(-20, -38, 13, 76, { fill: PALETTE.ink }), // spine
        rect(-20, -38, 40, 12, { fill: PALETTE.ink }), // top arm
        rect(20, -38, 13, 34, { fill: PALETTE.ink }), // right side of bowl
        rect(-20, -14, 40, 12, { fill: PALETTE.ink }), // middle arm closing the bowl
      ],
      {}
    )
  },
  // L-tetromino: a vertical bar of three unit squares with a foot at the bottom
  // right. Chiral (its mirror is the J-tetromino), so rotation and reflection
  // give visibly different results — ideal for rotation items.
  l_tetromino() {
    const u = 20
    // cells (col,row): three stacked + one foot; centred on the origin.
    const cells = [
      [0, 0],
      [0, 1],
      [0, 2],
      [1, 2],
    ]
    const cx0 = u // cols span 0..1 -> width 2u, centre x = u
    const cy0 = 1.5 * u // rows span 0..2 -> height 3u, centre y = 1.5u
    return group(
      cells.map(([c, r]) =>
        rect(c * u - cx0, r * u - cy0, u, u, {
          fill: PALETTE.ink,
          stroke: '#ffffff',
          'stroke-width': 1.5,
        })
      ),
      {}
    )
  },
}

function transformAttr(cx, cy, transform) {
  if (!transform) return `translate(${num(cx)} ${num(cy)})`
  if (transform.rotate != null) return `translate(${num(cx)} ${num(cy)}) rotate(${num(transform.rotate)})`
  if (transform.reflect === 'vertical') return `translate(${num(cx)} ${num(cy)}) scale(-1 1)`
  if (transform.reflect === 'horizontal') return `translate(${num(cx)} ${num(cy)}) scale(1 -1)`
  return `translate(${num(cx)} ${num(cy)})`
}

export function renderFigureTransform(spec) {
  const width = spec.width ?? 200
  const height = spec.height ?? 200
  const draw = FIGURES[spec.figure]
  if (!draw) throw new Error(`figure_transform: unknown figure "${spec.figure}"`)

  const cx = width / 2
  const cy = height / 2 + (spec.stimulus ? 6 : 0)
  const body = []

  // Reflection stimulus shows the original beside a dashed vertical mirror line.
  const figCx = spec.mirror === 'vertical' ? cx - 34 : cx
  body.push(group([draw()], { transform: transformAttr(figCx, cy, spec.transform) }))

  if (spec.mirror === 'vertical') {
    const mx = cx + 30
    body.push(line(mx, 18, mx, height - 18, { stroke: PALETTE.accent, 'stroke-width': 2, 'stroke-dasharray': '7 5' }))
    body.push(text(mx + 4, 16, 'mirror', { anchor: 'start', size: 10, fill: PALETTE.accent }))
  }
  if (spec.rotation_hint) {
    body.push(text(cx, height - 8, spec.rotation_hint, { anchor: 'middle', size: 11, fill: PALETTE.muted }))
  }

  return svgDocument({ width, height, title: spec.alt_text, body: body.join('') })
}
