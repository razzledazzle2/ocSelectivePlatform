// isometric_3d_views — top/front view stimulus + isometric-solid options (ts3-017).
//
// Stimulus spec: { type:"isometric_3d_views", stimulus:true,
//                  top_view:{ squares:[[col,row],...] },
//                  front_view:{ squares:[[col,row],...] } }
// Option spec:   { type:"isometric_3d_views", solid:{ cells:[{col,row,level}] } }
//
// Options reuse the shared isometric cube renderer so a "solid" reads identically
// to the isometric_cube_stack diagrams.

import { PALETTE, group, num, rect, svgDocument, text } from './svg-core.mjs'
import { renderCubesMarkup } from './isometric-cubes.mjs'

const U = 26

/** A small 2D grid of filled unit squares (row increases upward). */
function squareGrid(squares, ox, oy, label) {
  const cols = Math.max(...squares.map(([c]) => c)) + 1
  const rows = Math.max(...squares.map(([, r]) => r)) + 1
  const gridW = cols * U
  const gridH = rows * U
  const parts = []
  for (const [c, r] of squares) {
    parts.push(
      rect(ox + c * U, oy + (rows - 1 - r) * U, U, U, {
        fill: '#e5e7eb',
        stroke: PALETTE.ink,
        'stroke-width': 1.75,
      })
    )
  }
  parts.push(text(ox + gridW / 2, oy + gridH + 18, label, { anchor: 'middle', size: 11, weight: 600, fill: PALETTE.muted }))
  return { markup: group(parts, {}), gridW, gridH }
}

export function renderIsometric3dViews(spec) {
  if (spec.solid) {
    const width = spec.width ?? 220
    const height = spec.height ?? 200
    return svgDocument({
      width,
      height,
      title: spec.alt_text,
      body: renderCubesMarkup(spec.solid.cells, width, height, 0),
    })
  }

  // Stimulus: top view and front view side by side.
  const width = spec.width ?? 320
  const height = spec.height ?? 170
  const top = squareGrid(spec.top_view.squares, 40, 30, 'Top view')
  const frontOx = 40 + top.gridW + 70
  const front = squareGrid(spec.front_view.squares, frontOx, 30 + top.gridH - U, 'Front view')
  return svgDocument({ width, height, title: spec.alt_text, body: top.markup + front.markup })
}
