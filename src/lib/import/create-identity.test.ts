/**
 * Regression tests for the imported-question identity policy.
 *
 * These lock in the fix for content-based duplicate skipping: a question's identity is its
 * explicit `external_id` and nothing else. Identical wording, options, answers or stimulus
 * text never make two rows a duplicate — only a shared `external_id` does.
 *
 * Run with: node --test --experimental-strip-types "src/lib/import/*.test.ts" (wired to `npm test`).
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { createRowExternalIdCollides, partitionCreateRowsByIdentity } from './create-identity.ts'

/** A create row as far as identity is concerned — extra fields prove content is ignored. */
interface Row {
  externalId: string | null
  questionText: string
  stimulusExternalRef?: string
  packageId?: string
}

const SAME_QUESTION = 'What is the main purpose of the passage?'

test('createRowExternalIdCollides: matching wording with a fresh external_id does NOT collide', () => {
  const existing = new Set(['reading-river-q1'])
  const row: Row = { externalId: 'reading-mountain-q1', questionText: SAME_QUESTION }
  assert.equal(createRowExternalIdCollides(row, existing), false)
})

test('createRowExternalIdCollides: only an already-present external_id collides', () => {
  const existing = new Set(['reading-river-q1'])
  assert.equal(createRowExternalIdCollides({ externalId: 'reading-river-q1', questionText: 'x' }, existing), true)
  assert.equal(createRowExternalIdCollides({ externalId: '', questionText: 'x' }, existing), false)
  assert.equal(createRowExternalIdCollides({ externalId: null, questionText: 'x' }, existing), false)
})

// -- Case A: same question text, different stimuli --------------------------------------------
test('Case A: same wording under two different stimuli both import (zero content skips)', () => {
  const rows: Row[] = [
    { externalId: 'river-q1', questionText: SAME_QUESTION, stimulusExternalRef: 'stimulus-river' },
    { externalId: 'mountain-q1', questionText: SAME_QUESTION, stimulusExternalRef: 'stimulus-mountain' },
  ]
  const { toInsert, skipped } = partitionCreateRowsByIdentity(rows, new Set())
  assert.equal(toInsert.length, 2)
  assert.equal(skipped.length, 0)
  assert.deepEqual(
    toInsert.map((r) => r.stimulusExternalRef),
    ['stimulus-river', 'stimulus-mountain']
  )
})

// -- Case B: same question text AND options, different external_ids ---------------------------
test('Case B: identical wording and options with different external_ids both import', () => {
  const rows: Row[] = [
    { externalId: 'q-100', questionText: SAME_QUESTION },
    { externalId: 'q-200', questionText: SAME_QUESTION },
  ]
  const { toInsert, skipped } = partitionCreateRowsByIdentity(rows, new Set())
  assert.equal(toInsert.length, 2)
  assert.equal(skipped.length, 0)
})

// -- Case C: same question text in different packages -----------------------------------------
test('Case C: same wording across different packages both import', () => {
  const rows: Row[] = [
    { externalId: 'pkgA-q1', questionText: SAME_QUESTION, packageId: 'pkgA' },
    { externalId: 'pkgB-q1', questionText: SAME_QUESTION, packageId: 'pkgB' },
  ]
  const { toInsert, skipped } = partitionCreateRowsByIdentity(rows, new Set())
  assert.equal(toInsert.length, 2)
  assert.equal(skipped.length, 0)
})

// -- Case D: many identical-looking rows in one package, separate external_ids ----------------
test('Case D: every identical-looking row with its own external_id imports separately', () => {
  const rows: Row[] = Array.from({ length: 30 }, (_, index) => ({
    externalId: `bulk-q${index + 1}`,
    questionText: SAME_QUESTION,
  }))
  const { toInsert, skipped } = partitionCreateRowsByIdentity(rows, new Set())
  assert.equal(toInsert.length, 30)
  assert.equal(skipped.length, 0)
})

// -- Case E: an existing historical question shares the wording -------------------------------
test('Case E: a new row still imports when an existing question has the same wording', () => {
  // The bank already holds a question with this exact text under external_id "legacy-q1".
  // The new import uses a different external_id, so it must still be created.
  const existing = new Set(['legacy-q1'])
  const rows: Row[] = [{ externalId: 'new-q1', questionText: SAME_QUESTION }]
  const { toInsert, skipped } = partitionCreateRowsByIdentity(rows, existing)
  assert.equal(toInsert.length, 1)
  assert.equal(skipped.length, 0)
})

// -- Idempotent re-import: the SAME external_id is the only thing that skips -------------------
test('re-importing the same external_id in create mode skips exactly that row', () => {
  const existing = new Set(['river-q1'])
  const rows: Row[] = [
    { externalId: 'river-q1', questionText: SAME_QUESTION }, // already in bank → skip
    { externalId: 'river-q2', questionText: SAME_QUESTION }, // new → insert
  ]
  const { toInsert, skipped } = partitionCreateRowsByIdentity(rows, existing)
  assert.deepEqual(
    toInsert.map((r) => r.externalId),
    ['river-q2']
  )
  assert.deepEqual(
    skipped.map((r) => r.externalId),
    ['river-q1']
  )
})
