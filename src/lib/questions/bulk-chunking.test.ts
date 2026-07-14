/**
 * Unit tests for chunkIds — the sequencing primitive every bulk mutation uses.
 * Run with: node --test --experimental-strip-types "src/lib/questions/*.test.ts" (wired to `npm test`).
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { chunkIds } from './bulk-chunking.ts'

test('empty input produces no chunks', () => {
  assert.deepEqual(chunkIds([], 250), [])
})

test('input smaller than the chunk size produces one chunk', () => {
  const ids = Array.from({ length: 10 }, (_, i) => `id-${i}`)
  assert.deepEqual(chunkIds(ids, 250), [ids])
})

test('an exact multiple of the chunk size divides evenly with no trailing empty chunk', () => {
  const ids = Array.from({ length: 500 }, (_, i) => `id-${i}`)
  const chunks = chunkIds(ids, 250)
  assert.equal(chunks.length, 2)
  assert.equal(chunks[0].length, 250)
  assert.equal(chunks[1].length, 250)
})

test('501 ids at chunk size 250 produces three chunks: 250, 250, 1 — the documented target shape', () => {
  const ids = Array.from({ length: 501 }, (_, i) => `id-${i}`)
  const chunks = chunkIds(ids, 250)
  assert.deepEqual(
    chunks.map((chunk) => chunk.length),
    [250, 250, 1]
  )
})

test('chunks preserve original order and every id exactly once', () => {
  const ids = Array.from({ length: 733 }, (_, i) => `id-${i}`)
  const chunks = chunkIds(ids, 100)
  assert.deepEqual(chunks.flat(), ids)
})

test('a non-positive chunk size throws rather than looping forever', () => {
  assert.throws(() => chunkIds(['a', 'b'], 0))
  assert.throws(() => chunkIds(['a', 'b'], -5))
})
