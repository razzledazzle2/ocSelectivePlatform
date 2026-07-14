/**
 * Unit tests for the option_asset_refs_json parser. Covers the legacy string form ({"A": "a.png"}),
 * the array form ({"A": ["a.png"]}) shipped by the question-package generator, mixed forms, the
 * "only the first ref is used per option" rule, and malformed shapes that must surface as an error
 * rather than silently becoming an empty option list.
 * Run with: node --test --experimental-strip-types "src/lib/import/*.test.ts" (wired to `npm test`).
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { normaliseOptionAssetValue, parseOptionAssetRefs } from './option-asset-refs.ts'

test('normaliseOptionAssetValue accepts string and array forms, trims and drops blanks', () => {
  assert.deepEqual(normaliseOptionAssetValue('a.png'), ['a.png'])
  assert.deepEqual(normaliseOptionAssetValue('  a.png  '), ['a.png'])
  assert.deepEqual(normaliseOptionAssetValue(''), [])
  assert.deepEqual(normaliseOptionAssetValue(['a.png', ' b.png ']), ['a.png', 'b.png'])
  assert.deepEqual(normaliseOptionAssetValue(['a.png', '', '   ']), ['a.png'])
  assert.deepEqual(normaliseOptionAssetValue([]), [])
  // Non-string entries in an array are dropped, not fatal at this level.
  assert.deepEqual(normaliseOptionAssetValue(['a.png', 5 as unknown as string]), ['a.png'])
  // Neither string nor array → empty list.
  assert.deepEqual(normaliseOptionAssetValue(42), [])
  assert.deepEqual(normaliseOptionAssetValue(null), [])
})

test('string-form option asset refs parse to a per-label map', () => {
  const result = parseOptionAssetRefs(
    '{"A":"assets/ex/option-a.png","B":"assets/ex/option-b.png","C":"assets/ex/option-c.png","D":"assets/ex/option-d.png"}'
  )
  assert.equal(result.invalid, false)
  assert.deepEqual(result.multi, [])
  assert.deepEqual(result.map, {
    A: 'assets/ex/option-a.png',
    B: 'assets/ex/option-b.png',
    C: 'assets/ex/option-c.png',
    D: 'assets/ex/option-d.png',
  })
})

test('array-form option asset refs parse identically (the shape this package ships)', () => {
  const result = parseOptionAssetRefs(
    '{"A":["assets/ts-pattern-001/option-a.png"],"B":["assets/ts-pattern-001/option-b.png"],"C":["assets/ts-pattern-001/option-c.png"],"D":["assets/ts-pattern-001/option-d.png"]}'
  )
  assert.equal(result.invalid, false)
  assert.deepEqual(result.multi, [])
  assert.deepEqual(result.map, {
    A: 'assets/ts-pattern-001/option-a.png',
    B: 'assets/ts-pattern-001/option-b.png',
    C: 'assets/ts-pattern-001/option-c.png',
    D: 'assets/ts-pattern-001/option-d.png',
  })
})

test('mixed string/array forms are both accepted', () => {
  const result = parseOptionAssetRefs('{"A":"a.png","B":["b.png"]}')
  assert.equal(result.invalid, false)
  assert.deepEqual(result.map, { A: 'a.png', B: 'b.png' })
})

test('a label with several refs keeps the first and reports the label in multi', () => {
  const result = parseOptionAssetRefs('{"A":["a1.png","a2.png"],"B":["b.png"]}')
  assert.equal(result.invalid, false)
  assert.deepEqual(result.map, { A: 'a1.png', B: 'b.png' })
  assert.deepEqual(result.multi, ['A'])
})

test('lowercase labels are upper-cased; empty/blank arrays contribute no option', () => {
  const result = parseOptionAssetRefs('{"a":"a.png","b":[],"c":["   "]}')
  assert.equal(result.invalid, false)
  assert.deepEqual(result.map, { A: 'a.png' })
})

test('an empty cell is not invalid — it just has no refs', () => {
  const result = parseOptionAssetRefs('   ')
  assert.equal(result.invalid, false)
  assert.equal(result.map, null)
})

test('malformed shapes are invalid, never a silent empty list', () => {
  assert.equal(parseOptionAssetRefs('not json').invalid, true)
  assert.equal(parseOptionAssetRefs('["a.png"]').invalid, true) // top-level array, not an object
  assert.equal(parseOptionAssetRefs('{"A":42}').invalid, true) // value neither string nor array
  assert.equal(parseOptionAssetRefs('{"A":{"nested":"x"}}').invalid, true) // nested object value
  assert.equal(parseOptionAssetRefs('{"Z":"a.png"}').invalid, true) // label outside A–E
})
