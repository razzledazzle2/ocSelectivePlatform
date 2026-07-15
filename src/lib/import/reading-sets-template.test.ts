/**
 * Verifies the CSV contract for reading question sets on the BUILT template:
 * existing A–E standalone rows are untouched, asset refs stay in their correct
 * columns, and the new set / A–G / shared-pool columns line up.
 * Uses only node-safe modules (buildCsvTemplate + parseCsvText).
 * Run with: node --test --experimental-strip-types "src/lib/import/*.test.ts".
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { buildCsvTemplate, CSV_TEMPLATE_HEADERS } from './csv-template.ts'
import { parseCsvText } from '../csv/parse.ts'

const table = parseCsvText(buildCsvTemplate())
const header = table[0]
const rows = table.slice(1)

const col = (name: string): number => {
  const index = header.indexOf(name)
  assert.notEqual(index, -1, `template is missing the "${name}" column`)
  return index
}

const rowByExternalId = (externalId: string): string[] => {
  const idCol = col('external_id')
  const row = rows.find((cells) => cells[idCol] === externalId)
  assert.ok(row, `template is missing the "${externalId}" example row`)
  return row
}

// (1)(2) An existing A–E standalone question carries NO set columns and keeps
// behaving exactly as before.
test('a standalone A–E row has no question_set_id and five option columns', () => {
  const row = rowByExternalId('mr-perc-001')
  assert.equal(row[col('question_set_id')], '')
  assert.equal(row[col('question_order_in_set')], '')
  assert.equal(row[col('correct_answer')], 'C')
  // Options A–E present, F/G blank for this legacy row.
  assert.equal(row[col('option_a')], '60')
  assert.equal(row[col('option_e')], '150')
  assert.equal(row[col('option_f')], '')
  assert.equal(row[col('option_g')], '')
})

// (13) Passage media lives in stimulus_asset_refs; question media in
// question_asset_refs — the template must not cross them.
test('the owl reading row keeps its asset ref in stimulus_asset_refs, not question_asset_refs', () => {
  const row = rowByExternalId('rd-owl-003')
  assert.equal(row[col('stimulus_asset_refs')], 'asset://pending/owl-illustration.png')
  assert.equal(row[col('question_asset_refs')], '')
})

// (5) Two rows sharing one question_set_id form one set; the definition lives on
// the first row only.
test('two reading rows share one question_set_id (set definition on the first row)', () => {
  const first = rowByExternalId('rd-set-lighthouse-01')
  const second = rowByExternalId('rd-set-lighthouse-02')
  assert.equal(first[col('question_set_id')], 'set-lighthouse')
  assert.equal(second[col('question_set_id')], 'set-lighthouse')
  assert.equal(first[col('question_set_title')], 'The Lighthouse Keeper')
  assert.equal(second[col('question_set_title')], '') // member row carries only the ref
  assert.equal(first[col('question_order_in_set')], '1')
  assert.equal(second[col('question_order_in_set')], '2')
})

// (12) Passage attribution columns are distinct from source_name/source_paper.
test('the reading set row carries stimulus attribution separate from question source', () => {
  const row = rowByExternalId('rd-set-lighthouse-01')
  assert.equal(row[col('stimulus_author')], 'M. Carrow')
  assert.equal(row[col('stimulus_source_title')], 'Coastal Stories')
  assert.equal(row[col('stimulus_source_url')], 'https://example.org/coastal-stories')
})

// (3)(11) Sentence insertion draws SEVEN options (A–G) from a shared pool.
test('the sentence-insertion row populates option_f/option_g and a shared_option_pool_id', () => {
  const row = rowByExternalId('rd-insert-23')
  assert.equal(row[col('question_set_type')], 'sentence_insertion')
  assert.equal(row[col('shared_option_pool_id')], 'pool-tides')
  assert.equal(row[col('stimulus_target_label')], '23')
  assert.notEqual(row[col('option_f')], '')
  assert.notEqual(row[col('option_g')], '')
  assert.equal(row[col('interaction_type')], 'shared_option_single_choice')
})

test('every built row has exactly one cell per header', () => {
  for (const row of rows) {
    assert.equal(row.length, CSV_TEMPLATE_HEADERS.length)
  }
})
