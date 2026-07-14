/**
 * Unit tests for selectQuestionsForBlueprint — deterministic, AI-free selection.
 * Run with: npm test (node --test --experimental-strip-types).
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { selectQuestionsForBlueprint } from './select.ts'
import type { SelectionCandidate } from './select.ts'
import type { MockBlueprintSpec } from './types.ts'

function candidate(id: string, partial: Partial<SelectionCandidate> = {}): SelectionCandidate {
  return {
    questionId: id,
    difficulty: 3,
    domainCode: null,
    subtopicCode: null,
    patternKey: null,
    correctOptionLabel: null,
    ...partial,
  }
}

function pool(n: number): SelectionCandidate[] {
  return Array.from({ length: n }, (_unused, index) =>
    candidate(`q${index}`, { patternKey: `p${index}`, correctOptionLabel: 'ABCD'[index % 4] })
  )
}

test('same seed and pool yield identical selection (deterministic)', () => {
  const spec: MockBlueprintSpec = { totalQuestions: { max: 5 } }
  const first = selectQuestionsForBlueprint(pool(20), spec, { seed: 42 }).selected.map((c) => c.questionId)
  const second = selectQuestionsForBlueprint(pool(20), spec, { seed: 42 }).selected.map((c) => c.questionId)
  assert.deepEqual(first, second)
})

test('respects the target count from the spec', () => {
  const spec: MockBlueprintSpec = { totalQuestions: { max: 4 } }
  const result = selectQuestionsForBlueprint(pool(20), spec, { seed: 1 })
  assert.equal(result.selected.length, 4)
})

test('excluded question ids are never selected', () => {
  const spec: MockBlueprintSpec = { totalQuestions: { max: 5 } }
  const exclude = new Set(['q0', 'q1', 'q2'])
  const result = selectQuestionsForBlueprint(pool(20), spec, { seed: 7, exclude })
  for (const chosen of result.selected) {
    assert.equal(exclude.has(chosen.questionId), false)
  }
})

test('required subtopics are satisfied before other picks', () => {
  const candidates: SelectionCandidate[] = [
    ...Array.from({ length: 10 }, (_u, i) => candidate(`filler${i}`, { subtopicCode: 'common', patternKey: `f${i}` })),
    candidate('rare', { subtopicCode: 'rare_subtopic', patternKey: 'r1' }),
  ]
  const spec: MockBlueprintSpec = { totalQuestions: { max: 3 }, requiredSubtopics: [{ subtopicCode: 'rare_subtopic' }] }
  const result = selectQuestionsForBlueprint(candidates, spec, { seed: 3 })
  assert.ok(result.selected.some((c) => c.questionId === 'rare'), 'required subtopic question must be selected')
})

test('domain minimums are filled from the pool', () => {
  const candidates: SelectionCandidate[] = [
    ...Array.from({ length: 8 }, (_u, i) => candidate(`num${i}`, { domainCode: 'number_algebra', patternKey: `n${i}` })),
    ...Array.from({ length: 8 }, (_u, i) => candidate(`geo${i}`, { domainCode: 'geometry_spatial', patternKey: `g${i}` })),
  ]
  const spec: MockBlueprintSpec = {
    totalQuestions: { max: 6 },
    domainTargets: [
      { domainCode: 'number_algebra', min: 3 },
      { domainCode: 'geometry_spatial', min: 3 },
    ],
  }
  const result = selectQuestionsForBlueprint(candidates, spec, { seed: 9 })
  const numCount = result.selected.filter((c) => c.domainCode === 'number_algebra').length
  const geoCount = result.selected.filter((c) => c.domainCode === 'geometry_spatial').length
  assert.ok(numCount >= 3, `expected >=3 number_algebra, got ${numCount}`)
  assert.ok(geoCount >= 3, `expected >=3 geometry_spatial, got ${geoCount}`)
})

test('notes warn when the pool is smaller than the target', () => {
  const spec: MockBlueprintSpec = { totalQuestions: { max: 10 } }
  const result = selectQuestionsForBlueprint(pool(3), spec, { seed: 1 })
  assert.equal(result.selected.length, 3)
  assert.ok(result.notes.some((note) => /eligible/.test(note)))
})
