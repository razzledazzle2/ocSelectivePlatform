/**
 * Unit tests for the bulk-action eligibility partitioners — these mirror the
 * exact guards the single-row mutations enforce (softDeleteQuestion,
 * publishQuestion/assertAssetsReadyForPublish), just applied to a batch.
 * Run with: node --test --experimental-strip-types "src/lib/questions/*.test.ts" (wired to `npm test`).
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  partitionMissingIds,
  partitionPublishEligibility,
  partitionTrashEligibility,
} from './bulk-eligibility.ts'

test('partitionMissingIds reports only requested ids absent from the found set', () => {
  const missing = partitionMissingIds(['a', 'b', 'c'], new Set(['a', 'c']))
  assert.equal(missing.length, 1)
  assert.equal(missing[0].questionId, 'b')
  assert.equal(missing[0].code, 'not_found')
})

test('partitionMissingIds returns nothing when every id was found', () => {
  assert.deepEqual(partitionMissingIds(['a', 'b'], new Set(['a', 'b'])), [])
})

test('partitionTrashEligibility: archived + not trashed needs a write', () => {
  const result = partitionTrashEligibility([{ id: 'q1', status: 'archived', deletedAt: null }])
  assert.deepEqual(result.toUpdateIds, ['q1'])
  assert.deepEqual(result.alreadyDoneIds, [])
  assert.deepEqual(result.failed, [])
})

test('partitionTrashEligibility: already trashed is an idempotent success, not a failure', () => {
  const result = partitionTrashEligibility([{ id: 'q1', status: 'archived', deletedAt: '2026-01-01T00:00:00Z' }])
  assert.deepEqual(result.toUpdateIds, [])
  assert.deepEqual(result.alreadyDoneIds, ['q1'])
  assert.deepEqual(result.failed, [])
})

test('partitionTrashEligibility: a non-archived (active) question is refused, not silently skipped', () => {
  const result = partitionTrashEligibility([{ id: 'q1', status: 'draft', deletedAt: null }])
  assert.deepEqual(result.toUpdateIds, [])
  assert.deepEqual(result.alreadyDoneIds, [])
  assert.equal(result.failed.length, 1)
  assert.equal(result.failed[0].questionId, 'q1')
  assert.equal(result.failed[0].code, 'not_archived')
})

test('partitionTrashEligibility: mixed batch partitions each row independently', () => {
  const result = partitionTrashEligibility([
    { id: 'archived', status: 'archived', deletedAt: null },
    { id: 'trashed', status: 'archived', deletedAt: '2026-01-01T00:00:00Z' },
    { id: 'draft', status: 'draft', deletedAt: null },
    { id: 'published', status: 'published', deletedAt: null },
  ])
  assert.deepEqual(result.toUpdateIds, ['archived'])
  assert.deepEqual(result.alreadyDoneIds, ['trashed'])
  assert.deepEqual(
    result.failed.map((f) => f.questionId),
    ['draft', 'published']
  )
  assert.ok(result.failed.every((f) => f.code === 'not_archived'))
})

test('partitionPublishEligibility: draft/reviewed with no unready assets is eligible', () => {
  const result = partitionPublishEligibility([{ id: 'q1', status: 'draft', unreadyAssetCount: 0 }])
  assert.deepEqual(result.toUpdateIds, ['q1'])
  assert.deepEqual(result.failed, [])
})

test('partitionPublishEligibility: already published is an idempotent success', () => {
  const result = partitionPublishEligibility([{ id: 'q1', status: 'published', unreadyAssetCount: 0 }])
  assert.deepEqual(result.toUpdateIds, [])
  assert.deepEqual(result.alreadyDoneIds, ['q1'])
  assert.deepEqual(result.failed, [])
})

test('partitionPublishEligibility: archived questions cannot be published directly', () => {
  const result = partitionPublishEligibility([{ id: 'q1', status: 'archived', unreadyAssetCount: 0 }])
  assert.deepEqual(result.toUpdateIds, [])
  assert.equal(result.failed.length, 1)
  assert.equal(result.failed[0].code, 'archived_blocks_publish')
})

test('partitionPublishEligibility: pending/rejected required assets block publish, mirroring assertAssetsReadyForPublish', () => {
  const result = partitionPublishEligibility([{ id: 'q1', status: 'reviewed', unreadyAssetCount: 2 }])
  assert.deepEqual(result.toUpdateIds, [])
  assert.equal(result.failed.length, 1)
  assert.equal(result.failed[0].code, 'assets_not_ready')
  assert.match(result.failed[0].reason, /2 pending or rejected assets/)
})

test('partitionPublishEligibility: singular asset count reads naturally', () => {
  const result = partitionPublishEligibility([{ id: 'q1', status: 'draft', unreadyAssetCount: 1 }])
  assert.match(result.failed[0].reason, /1 pending or rejected asset\.$/)
})

test('partitionPublishEligibility: mixed batch partitions each row independently', () => {
  const result = partitionPublishEligibility([
    { id: 'ready', status: 'draft', unreadyAssetCount: 0 },
    { id: 'published', status: 'published', unreadyAssetCount: 0 },
    { id: 'archived', status: 'archived', unreadyAssetCount: 0 },
    { id: 'unready', status: 'reviewed', unreadyAssetCount: 3 },
  ])
  assert.deepEqual(result.toUpdateIds, ['ready'])
  assert.deepEqual(result.alreadyDoneIds, ['published'])
  assert.deepEqual(
    result.failed.map((f) => [f.questionId, f.code]),
    [
      ['archived', 'archived_blocks_publish'],
      ['unready', 'assets_not_ready'],
    ]
  )
})
