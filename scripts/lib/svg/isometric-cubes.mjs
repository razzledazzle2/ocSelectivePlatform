// Isometric unit-cube renderer, shared by isometric_cube_stack (mr2-015) and the
// isometric_3d_views options (ts3-017). A solid is a set of filled unit cells
// { col, row, level }; cubes are drawn back-to-front with three visible faces
// (light-grey top, white front + right) so individual cubes can be counted.

import { PALETTE, num, polygon, svgDocument, text } from './svg-core.mjs'

const TILE_HW = 24 // half-width of a tile in px
const TILE_HH = 12 // half-height of a tile in px
const CUBE_H = 28 // vertical rise of one cube in px

const TOP_FILL = '#e5e7eb'
const FRONT_FILL = '#ffffff'
const RIGHT_FILL = '#f3f4f6'

/** Projects a 3D grid corner (X right, Y back, Z up) to screen space. */
function project(X, Y, Z) {
  return [(X - Y) * TILE_HW, (X + Y) * TILE_HH - Z * CUBE_H]
}

/** The three visible faces of the unit cube at (col,row,level), as point lists. */
function cubeFaces(col, row, level) {
  const p = (X, Y, Z) => project(col + X, row + Y, level + Z)
  return {
    top: [p(0, 0, 1), p(1, 0, 1), p(1, 1, 1), p(0, 1, 1)],
    front: [p(0, 0, 0), p(1, 0, 0), p(1, 0, 1), p(0, 0, 1)],
    right: [p(1, 0, 0), p(1, 1, 0), p(1, 1, 1), p(1, 0, 1)],
  }
}

/**
 * Renders a set of unit cubes centred in a `width`×`height` box.
 * Returns SVG markup; callers wrap it (with any labels) in svgDocument.
 */
export function renderCubesMarkup(cells, width, height, topY = 0) {
  // Bounds of all projected corners, to centre the solid.
  const xs = []
  const ys = []
  for (const c of cells) {
    const f = cubeFaces(c.col, c.row, c.level)
    for (const face of Object.values(f)) {
      for (const [x, y] of face) {
        xs.push(x)
        ys.push(y)
      }
    }
  }
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  const offX = width / 2 - (minX + maxX) / 2
  const offY = topY + (height - topY) / 2 - (minY + maxY) / 2

  // Painter's order: back rows first, then lower levels, then left columns.
  const ordered = [...cells].sort((a, b) => b.row - a.row || a.level - b.level || a.col - b.col)

  const faceEl = (pts, fill) =>
    polygon(pts.map(([x, y]) => [x + offX, y + offY]), {
      fill,
      stroke: PALETTE.ink,
      'stroke-width': 1.5,
      'stroke-linejoin': 'round',
    })

  const parts = []
  for (const c of ordered) {
    const f = cubeFaces(c.col, c.row, c.level)
    parts.push(faceEl(f.right, RIGHT_FILL))
    parts.push(faceEl(f.front, FRONT_FILL))
    parts.push(faceEl(f.top, TOP_FILL))
  }
  return parts.join('')
}

/** Expands a layered stack spec into unit cells (used by isometric_cube_stack). */
export function layersToCells(spec) {
  const width = spec.width_cubes ?? 1
  const cells = []
  let level = 0
  for (const layer of spec.layers ?? []) {
    const tall = layer.tall ?? 1
    for (let t = 0; t < tall; t += 1) {
      for (let col = 0; col < width; col += 1) {
        for (let row = 0; row < layer.deep; row += 1) {
          // align:"back" keeps each layer flush with the largest row index.
          const maxDeep = Math.max(...spec.layers.map((l) => l.deep))
          const rowIndex = spec.align === 'back' ? maxDeep - layer.deep + row : row
          cells.push({ col, row: rowIndex, level: level + t })
        }
      }
    }
    level += tall
  }
  return cells
}

export function renderIsometricCubeStack(spec) {
  const width = spec.width ?? 460
  const height = spec.height ?? 380
  const cells = spec.cells ?? layersToCells(spec)
  const captionH = spec.caption ? 22 : 0
  const body = []
  if (spec.title) {
    body.push(text(width / 2, 22, spec.title, { anchor: 'middle', size: 14, weight: 700, fill: PALETTE.ink }))
  }
  body.push(renderCubesMarkup(cells, width, height - captionH, spec.title ? 30 : 0))
  if (spec.caption) {
    body.push(text(width / 2, height - 8, spec.caption, { anchor: 'middle', size: 11, fill: PALETTE.muted }))
  }
  return svgDocument({ width, height, title: spec.title ?? spec.alt_text, body: body.join('') })
}
