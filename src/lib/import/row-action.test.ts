/**
 * Unit tests for decideRowAction (import mode × existing-match matrix).
 * Run with: node --test --experimental-strip-types "src/lib/import/*.test.ts" (wired to `npm test`).
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { decideRowAction } from './row-action.ts'

test('create mode with no existing match creates', () => {
  assert.deepEqual(decideRowAction('create', false, 'q-1'), { action: 'create' })
})

test('create mode with an existing match is flagged as a skipped duplicate, not an error', () => {
  const result = decideRowAction('create', true, 'q-1')
  assert.equal(result.action, 'skip_duplicate')
  assert.match(result.message, /already exists/)
  assert.match(result.message, /create new only/)
})

test('update mode with no existing match is blocked (cannot create)', () => {
  const result = decideRowAction('update', false, 'q-1')
  assert.equal(result.action, 'blocked')
  assert.match(result.message, /No existing question/)
  assert.match(result.message, /update-only mode cannot create/)
})

test('update mode with an existing match updates', () => {
  assert.deepEqual(decideRowAction('update', true, 'q-1'), { action: 'update' })
})

test('create_and_update creates when absent and updates when present', () => {
  assert.deepEqual(decideRowAction('create_and_update', false, 'q-1'), { action: 'create' })
  assert.deepEqual(decideRowAction('create_and_update', true, 'q-1'), { action: 'update' })
})
