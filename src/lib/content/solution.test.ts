/**
 * The worked solution is authoritative; a legacy short_explanation is only used
 * as a fallback so deprecated-only content is preserved (never silently lost).
 * Run: npm test
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { resolveSolution } from './solution.ts'

test('worked solution wins when both are present (legacy record with both fields)', () => {
  assert.equal(resolveSolution('Full worked solution.', 'One-line takeaway.'), 'Full worked solution.')
})

test('legacy record with only a short explanation is preserved into the solution', () => {
  assert.equal(resolveSolution(null, 'One quarter of 360 is 90.'), 'One quarter of 360 is 90.')
  assert.equal(resolveSolution('   ', 'Kept.'), 'Kept.')
})

test('nothing to show returns null', () => {
  assert.equal(resolveSolution(null, null), null)
  assert.equal(resolveSolution('', '   '), null)
})
