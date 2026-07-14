/**
 * Unit tests for the pure question-selection state machine behind
 * useQuestionSelection: explicit multi-select (incl. shift-click ranges) and
 * all-matching-filters selection, and how a bulk action's result folds back
 * into each mode.
 * Run with: node --test --experimental-strip-types "src/lib/questions/*.test.ts" (wired to `npm test`).
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  applyMutationResult,
  computeShiftRange,
  createEmptySelection,
  effectiveSelectedCount,
  enterAllMatching,
  headerCheckboxState,
  isRowSelected,
  toggleAllVisible,
  toggleRow,
  toggleRows,
  toSelectionInput,
} from './bulk-selection-model.ts'

const PAGE = ['a', 'b', 'c', 'd', 'e']

test('createEmptySelection starts explicit and empty', () => {
  const state = createEmptySelection()
  assert.equal(state.mode, 'explicit')
  assert.equal(effectiveSelectedCount(state), 0)
})

test('toggleRow adds and removes ids in explicit mode', () => {
  let state = createEmptySelection()
  state = toggleRow(state, 'a', true)
  assert.ok(isRowSelected(state, 'a'))
  assert.equal(effectiveSelectedCount(state), 1)
  state = toggleRow(state, 'a', false)
  assert.ok(!isRowSelected(state, 'a'))
  assert.equal(effectiveSelectedCount(state), 0)
})

test('toggleRow in allMatching mode only ever manages exclusions, never grows an id list', () => {
  let state = enterAllMatching({}, '2026-01-01T00:00:00Z', 100)
  assert.equal(effectiveSelectedCount(state), 100)
  assert.ok(isRowSelected(state, 'anything')) // default-selected — nothing excluded yet

  state = toggleRow(state, 'x', false) // uncheck -> exclude
  assert.ok(!isRowSelected(state, 'x'))
  assert.equal(effectiveSelectedCount(state), 99)

  state = toggleRow(state, 'x', true) // re-check -> un-exclude
  assert.ok(isRowSelected(state, 'x'))
  assert.equal(effectiveSelectedCount(state), 100)
})

test('headerCheckboxState is unchecked, indeterminate or checked based on the visible page only', () => {
  let state = createEmptySelection()
  assert.equal(headerCheckboxState(state, PAGE), 'unchecked')

  state = toggleRow(state, 'a', true)
  assert.equal(headerCheckboxState(state, PAGE), 'indeterminate')

  state = toggleRows(state, PAGE, true)
  assert.equal(headerCheckboxState(state, PAGE), 'checked')
})

test('headerCheckboxState handles an empty page as unchecked', () => {
  assert.equal(headerCheckboxState(createEmptySelection(), []), 'unchecked')
})

test('toggleAllVisible selects every visible row when none are selected', () => {
  const state = toggleAllVisible(createEmptySelection(), PAGE)
  assert.equal(headerCheckboxState(state, PAGE), 'checked')
  assert.equal(effectiveSelectedCount(state), PAGE.length)
})

test('toggleAllVisible clears the page when every visible row is already selected', () => {
  let state = toggleRows(createEmptySelection(), PAGE, true)
  state = toggleAllVisible(state, PAGE)
  assert.equal(effectiveSelectedCount(state), 0)
})

test('toggleAllVisible exits allMatching mode back to an explicit page selection', () => {
  const allMatching = enterAllMatching({}, '2026-01-01T00:00:00Z', 500)
  const next = toggleAllVisible(allMatching, PAGE)
  assert.equal(next.mode, 'explicit')
})

test('computeShiftRange selects the inclusive range downward', () => {
  assert.deepEqual(computeShiftRange(PAGE, 'a', 'd'), ['a', 'b', 'c', 'd'])
})

test('computeShiftRange selects the inclusive range upward (order-independent)', () => {
  assert.deepEqual(computeShiftRange(PAGE, 'd', 'a'), ['a', 'b', 'c', 'd'])
})

test('computeShiftRange with the same anchor and target returns just that one row', () => {
  assert.deepEqual(computeShiftRange(PAGE, 'c', 'c'), ['c'])
})

test('computeShiftRange returns null when either row is not on the current page (no cross-page ranges)', () => {
  assert.equal(computeShiftRange(PAGE, 'a', 'not-on-page'), null)
  assert.equal(computeShiftRange(PAGE, 'not-on-page', 'a'), null)
})

test('toggleRows applies a shift-click range in explicit mode', () => {
  const range = computeShiftRange(PAGE, 'b', 'd')
  assert.ok(range)
  const state = toggleRows(createEmptySelection(), range as string[], true)
  assert.deepEqual([...(state.mode === 'explicit' ? state.selectedIds : [])].sort(), ['b', 'c', 'd'])
})

test('toggleRows can also deselect a shift-click range', () => {
  let state = toggleRows(createEmptySelection(), PAGE, true)
  state = toggleRows(state, ['b', 'c', 'd'], false)
  assert.deepEqual([...(state.mode === 'explicit' ? state.selectedIds : [])].sort(), ['a', 'e'])
})

test('toSelectionInput serializes explicit mode as an id list', () => {
  const state = toggleRows(createEmptySelection(), ['a', 'b'], true)
  assert.deepEqual(toSelectionInput(state), { mode: 'explicit', ids: ['a', 'b'] })
})

test('toSelectionInput serializes allMatching mode with its filter snapshot, cutoff and exclusions — never an id list', () => {
  let state = enterAllMatching({ subjectId: 'math' }, '2026-01-01T00:00:00Z', 42)
  state = toggleRow(state, 'excluded-1', false)
  const input = toSelectionInput(state)
  assert.deepEqual(input, {
    mode: 'allMatching',
    filters: { subjectId: 'math' },
    cutoffTimestamp: '2026-01-01T00:00:00Z',
    excludedIds: ['excluded-1'],
  })
})

test('applyMutationResult (explicit): drops succeeded ids, keeps failed/blocked ids selected', () => {
  const state = toggleRows(createEmptySelection(), ['a', 'b', 'c'], true)
  const next = applyMutationResult(state, {
    succeededIds: ['a', 'b'],
    failed: [{ questionId: 'c', code: 'not_archived', reason: 'nope' }],
  })
  assert.equal(next.mode, 'explicit')
  assert.deepEqual([...(next.mode === 'explicit' ? next.selectedIds : [])], ['c'])
})

test('applyMutationResult (allMatching, no failures): collapses to an empty explicit selection', () => {
  const state = enterAllMatching({}, '2026-01-01T00:00:00Z', 300)
  const next = applyMutationResult(state, { succeededIds: [], failed: [] })
  assert.deepEqual(next, { mode: 'explicit', selectedIds: new Set() })
})

test('applyMutationResult (allMatching, a few failures): converts to an explicit selection of just the failed ids', () => {
  const state = enterAllMatching({}, '2026-01-01T00:00:00Z', 300)
  const next = applyMutationResult(state, {
    succeededIds: [],
    failed: [
      { questionId: 'x', code: 'not_archived', reason: 'nope' },
      { questionId: 'y', code: 'not_archived', reason: 'nope' },
    ],
  })
  assert.equal(next.mode, 'explicit')
  assert.deepEqual([...(next.mode === 'explicit' ? next.selectedIds : [])].sort(), ['x', 'y'])
})

test('applyMutationResult (allMatching, huge failure count): clears rather than holding thousands of ids in browser state', () => {
  const state = enterAllMatching({}, '2026-01-01T00:00:00Z', 5000)
  const failed = Array.from({ length: 500 }, (_, i) => ({
    questionId: `q${i}`,
    code: 'not_archived' as const,
    reason: 'nope',
  }))
  const next = applyMutationResult(state, { succeededIds: [], failed })
  assert.deepEqual(next, { mode: 'explicit', selectedIds: new Set() })
})
