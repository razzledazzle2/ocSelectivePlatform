/**
 * Deterministic reference-export selection tests: all / capped / balanced by
 * difficulty / balanced by pattern key. Selection must be reproducible.
 * Run: node --test --experimental-strip-types "src/lib/coverage/*.test.ts"
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { selectReferenceQuestions } from './core.ts'
import type { FullExportQuestion } from '../questions/export-full-csv.ts'

// selectReferenceQuestions only reads difficulty + patternKey; a minimal row is
// enough. externalId doubles as a stable identity for assertions.
function row(externalId: string, difficulty: number, patternKey: string | null): FullExportQuestion {
  return { externalId, difficulty, patternKey } as unknown as FullExportQuestion
}

const rows: FullExportQuestion[] = [
  row('e1', 1, 'p1'),
  row('e2', 1, 'p1'),
  row('e3', 3, 'p2'),
  row('e4', 4, 'p2'),
  row('e5', 5, 'p3'),
  row('e6', 2, null),
]

const ids = (r: FullExportQuestion[]) => r.map((x) => x.externalId)

test('all returns every row in the original order', () => {
  assert.deepEqual(ids(selectReferenceQuestions(rows, { strategy: 'all' })), [
    'e1', 'e2', 'e3', 'e4', 'e5', 'e6',
  ])
})

test('limit takes the first N in order', () => {
  assert.deepEqual(ids(selectReferenceQuestions(rows, { strategy: 'limit', limit: 3 })), [
    'e1', 'e2', 'e3',
  ])
})

test('limit above the row count returns everything', () => {
  assert.equal(selectReferenceQuestions(rows, { strategy: 'limit', limit: 999 }).length, rows.length)
})

test('balanced_difficulty interleaves easy → medium → hard → unknown', () => {
  // Bands: easy=[e1,e2,e6], medium=[e3], hard=[e4,e5]. Round-robin, limit 4:
  // e1 (easy), e3 (medium), e4 (hard), e2 (easy).
  assert.deepEqual(ids(selectReferenceQuestions(rows, { strategy: 'balanced_difficulty', limit: 4 })), [
    'e1', 'e3', 'e4', 'e2',
  ])
})

test('balanced_difficulty is deterministic across repeated calls', () => {
  const a = ids(selectReferenceQuestions(rows, { strategy: 'balanced_difficulty', limit: 5 }))
  const b = ids(selectReferenceQuestions(rows, { strategy: 'balanced_difficulty', limit: 5 }))
  assert.deepEqual(a, b)
})

test('balanced_pattern interleaves across distinct pattern keys', () => {
  // Pattern groups sorted: p1=[e1,e2], p2=[e3,e4], p3=[e5], none=[e6].
  // The blank-pattern group sorts first (' none'): e6, e1, e3, e5 for limit 4.
  assert.deepEqual(ids(selectReferenceQuestions(rows, { strategy: 'balanced_pattern', limit: 4 })), [
    'e6', 'e1', 'e3', 'e5',
  ])
})

test('balanced strategies with no limit reorder but keep every row', () => {
  const out = selectReferenceQuestions(rows, { strategy: 'balanced_pattern' })
  assert.equal(out.length, rows.length)
  assert.deepEqual([...ids(out)].sort(), ['e1', 'e2', 'e3', 'e4', 'e5', 'e6'])
})

test('empty input yields an empty selection for every strategy', () => {
  for (const strategy of ['all', 'limit', 'balanced_difficulty', 'balanced_pattern'] as const) {
    assert.deepEqual(selectReferenceQuestions([], { strategy, limit: 5 }), [])
  }
})
