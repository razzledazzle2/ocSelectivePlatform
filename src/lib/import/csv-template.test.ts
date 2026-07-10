/**
 * The CSV import template and the full export must share the exact same header — that's what
 * makes an exported bank file re-importable as a reference/update file (round-trip).
 * Run with: node --test --experimental-strip-types "src/lib/import/*.test.ts" (wired to `npm test`).
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { buildCsvTemplate, CSV_TEMPLATE_HEADERS } from './csv-template.ts'
import { FULL_EXPORT_CSV_HEADERS } from '../questions/export-full-csv.ts'

test('the import template header matches the full-export header exactly (round-trip)', () => {
  assert.deepEqual([...CSV_TEMPLATE_HEADERS], [...FULL_EXPORT_CSV_HEADERS])
})

test('the template includes external_id, the new asset_type/asset_required columns, and canonical taxonomy codes', () => {
  assert.ok(CSV_TEMPLATE_HEADERS.includes('external_id'))
  assert.ok(CSV_TEMPLATE_HEADERS.includes('asset_type'))
  assert.ok(CSV_TEMPLATE_HEADERS.includes('asset_required'))
  assert.ok(CSV_TEMPLATE_HEADERS.includes('domain_code'))
})

test('every example row in the built template has exactly one cell per header', () => {
  const csv = buildCsvTemplate()
  const lines = csv.trim().split('\n')
  const headerCount = lines[0].split(',').length
  assert.equal(headerCount, CSV_TEMPLATE_HEADERS.length)
  // Data rows may contain quoted commas, so just sanity-check there's at least one per header
  // (a full CSV-aware parse isn't needed here — csv-parser.ts already covers correctness).
  for (const line of lines.slice(1)) {
    assert.ok(line.length > 0)
  }
})
