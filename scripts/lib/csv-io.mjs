// Minimal, robust CSV read/write shared by the asset scan + normalise scripts.
// Handles quoted fields containing commas, quotes ("") and newlines. Round-trips
// with the same quoting rule the app's export uses (quote only when needed), so
// re-serialising untouched rows produces a minimal diff.

import { readFileSync, writeFileSync } from 'node:fs'

/** Parses CSV text into an array of string[] rows. */
export function parseCsv(text) {
  const rows = []
  let row = []
  let field = ''
  let inQuotes = false
  let i = 0
  const src = text.replace(/\r\n?/g, '\n')

  while (i < src.length) {
    const ch = src[i]
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"'
          i += 2
          continue
        }
        inQuotes = false
        i += 1
        continue
      }
      field += ch
      i += 1
      continue
    }
    if (ch === '"') {
      inQuotes = true
      i += 1
      continue
    }
    if (ch === ',') {
      row.push(field)
      field = ''
      i += 1
      continue
    }
    if (ch === '\n') {
      row.push(field)
      rows.push(row)
      row = []
      field = ''
      i += 1
      continue
    }
    field += ch
    i += 1
  }
  // Flush trailing field/row (unless the file ended on a newline with no extra data).
  if (field.length > 0 || row.length > 0) {
    row.push(field)
    rows.push(row)
  }
  return rows
}

function escapeCell(value) {
  const str = String(value ?? '')
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str
}

/** Serialises rows back to CSV text (trailing newline). */
export function serializeCsv(rows) {
  return rows.map((row) => row.map(escapeCell).join(',')).join('\n') + '\n'
}

export function readCsv(path) {
  return parseCsv(readFileSync(path, 'utf8'))
}

export function writeCsv(path, rows) {
  writeFileSync(path, serializeCsv(rows), 'utf8')
}

/** Builds a case-insensitive header→index map. */
export function headerIndex(headerRow) {
  const map = {}
  headerRow.forEach((name, index) => {
    map[name.replace(/^﻿/, '').trim().toLowerCase()] = index
  })
  return map
}
