// Shared, dependency-free helpers for deterministic SVG generation.
//
// Everything here is pure: a spec object in, an SVG string out. No randomness,
// no network, no filesystem — the same spec always yields byte-identical SVG so
// generated maths/thinking-skills diagrams are reviewable and diffable in git.

/** Rounds to at most 2 dp and strips trailing zeros so output stays compact and stable. */
export function num(value) {
  return Number.parseFloat(Number(value).toFixed(2)).toString()
}

/** Escapes a string for use in SVG text/attribute content. */
export function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Serialises an attribute map into ` key="value"` pairs (skips null/undefined). */
function attrs(map) {
  return Object.entries(map)
    .filter(([, value]) => value !== null && value !== undefined && value !== '')
    .map(([key, value]) => ` ${key}="${esc(value)}"`)
    .join('')
}

export function line(x1, y1, x2, y2, options = {}) {
  return `<line x1="${num(x1)}" y1="${num(y1)}" x2="${num(x2)}" y2="${num(y2)}"${attrs(options)} />`
}

export function rect(x, y, width, height, options = {}) {
  return `<rect x="${num(x)}" y="${num(y)}" width="${num(width)}" height="${num(height)}"${attrs(options)} />`
}

export function circle(cx, cy, r, options = {}) {
  return `<circle cx="${num(cx)}" cy="${num(cy)}" r="${num(r)}"${attrs(options)} />`
}

export function polygon(points, options = {}) {
  const pts = points.map(([x, y]) => `${num(x)},${num(y)}`).join(' ')
  return `<polygon points="${pts}"${attrs(options)} />`
}

export function polyline(points, options = {}) {
  const pts = points.map(([x, y]) => `${num(x)},${num(y)}`).join(' ')
  return `<polyline points="${pts}"${attrs(options)} />`
}

export function path(d, options = {}) {
  return `<path d="${d}"${attrs(options)} />`
}

/**
 * Text element. `anchor` maps to text-anchor (start/middle/end), `baseline` to
 * dominant-baseline. Font size/weight/fill are passed through options.
 */
export function text(x, y, content, options = {}) {
  const { anchor, baseline, size, weight, fill, ...rest } = options
  return `<text x="${num(x)}" y="${num(y)}"${attrs({
    'text-anchor': anchor,
    'dominant-baseline': baseline,
    'font-size': size,
    'font-weight': weight,
    fill,
    ...rest,
  })}>${esc(content)}</text>`
}

export function group(children, options = {}) {
  return `<g${attrs(options)}>${children.join('')}</g>`
}

/**
 * Wraps body markup in a complete, self-contained SVG document.
 * - `role="img"` + `<title>` gives assistive tech the alt text.
 * - A neutral font-family keeps rendering consistent across viewers.
 * - `viewBox` + width/height make it scale cleanly inside the app.
 */
export function svgDocument({ width, height, title, body, className }) {
  const titleMarkup = title ? `<title>${esc(title)}</title>` : ''
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${num(width)} ${num(height)}" ` +
    `width="${num(width)}" height="${num(height)}" role="img"${className ? ` class="${esc(className)}"` : ''} ` +
    `font-family="'Segoe UI', system-ui, -apple-system, sans-serif">` +
    `${titleMarkup}` +
    `<rect x="0" y="0" width="${num(width)}" height="${num(height)}" fill="#ffffff" />` +
    `${body}` +
    `</svg>`
  )
}

/** Shared palette — muted, print-friendly, matches the app's calm styling. */
export const PALETTE = {
  ink: '#1f2933',
  grid: '#d7dee7',
  axis: '#7b8794',
  muted: '#52606d',
  accent: '#2563eb',
  accentSoft: '#dbeafe',
  bar: '#3b82f6',
  fillSoft: '#eef2ff',
  danger: '#dc2626',
  green: '#bbf7d0',
}
