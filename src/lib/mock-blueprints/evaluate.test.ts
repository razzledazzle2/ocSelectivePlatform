/**
 * Unit tests for evaluateBlueprint — the deterministic, AI-free blueprint checker.
 * Run with: npm test (node --test --experimental-strip-types).
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { evaluateBlueprint } from './evaluate.ts'
import type { BlueprintQuestion, MockBlueprintSpec } from './types.ts'

function q(partial: Partial<BlueprintQuestion>): BlueprintQuestion {
  return {
    difficulty: 3,
    domainCode: null,
    subtopicCode: null,
    patternKey: null,
    correctOptionLabel: null,
    ...partial,
  }
}

test('no configured rules → satisfied with no checks', () => {
  const result = evaluateBlueprint([q({}), q({})], {})
  assert.equal(result.checks.length, 0)
  assert.equal(result.satisfied, true)
})

test('total questions min/max produces a check', () => {
  const spec: MockBlueprintSpec = { totalQuestions: { min: 3, max: 5 } }
  assert.equal(evaluateBlueprint([q({}), q({})], spec).checks[0].satisfied, false)
  assert.equal(evaluateBlueprint([q({}), q({}), q({})], spec).checks[0].satisfied, true)
})

test('required subtopics flag missing ones', () => {
  const spec: MockBlueprintSpec = { requiredSubtopics: [{ subtopicCode: 'fractions' }, { subtopicCode: 'algebra' }] }
  const result = evaluateBlueprint([q({ subtopicCode: 'fractions' })], spec)
  assert.equal(result.checks[0].satisfied, false)
  assert.match(result.checks[0].detail, /algebra/)
})

test('domain targets respect min and max', () => {
  const spec: MockBlueprintSpec = { domainTargets: [{ domainCode: 'number_algebra', min: 2, max: 3 }] }
  const two = evaluateBlueprint([q({ domainCode: 'number_algebra' }), q({ domainCode: 'number_algebra' })], spec)
  assert.equal(two.checks[0].satisfied, true)
  const one = evaluateBlueprint([q({ domainCode: 'number_algebra' })], spec)
  assert.equal(one.checks[0].satisfied, false)
})

test('difficulty targets counted per difficulty', () => {
  const spec: MockBlueprintSpec = { difficultyTargets: [{ difficulty: 5, min: 1 }] }
  assert.equal(evaluateBlueprint([q({ difficulty: 3 })], spec).checks[0].satisfied, false)
  assert.equal(evaluateBlueprint([q({ difficulty: 5 })], spec).checks[0].satisfied, true)
})

test('pattern diversity counts distinct non-empty keys', () => {
  const spec: MockBlueprintSpec = { minDistinctPatternKeys: 2 }
  const same = evaluateBlueprint([q({ patternKey: 'p1' }), q({ patternKey: 'p1' })], spec)
  assert.equal(same.checks[0].satisfied, false)
  const distinct = evaluateBlueprint([q({ patternKey: 'p1' }), q({ patternKey: 'p2' })], spec)
  assert.equal(distinct.checks[0].satisfied, true)
})

test('answer balance flags an over-represented answer letter', () => {
  const spec: MockBlueprintSpec = { maxAnswerShare: 0.5 }
  const skewed = evaluateBlueprint(
    [q({ correctOptionLabel: 'A' }), q({ correctOptionLabel: 'A' }), q({ correctOptionLabel: 'B' })],
    spec
  )
  assert.equal(skewed.checks[0].satisfied, false)
})

test('hardRules make a violation block (satisfied=false); soft ones only warn', () => {
  const spec: MockBlueprintSpec = { totalQuestions: { min: 10 }, hardRules: ['total'] }
  const hard = evaluateBlueprint([q({})], spec)
  assert.equal(hard.hardViolations, 1)
  assert.equal(hard.satisfied, false)

  const softSpec: MockBlueprintSpec = { totalQuestions: { min: 10 } }
  const soft = evaluateBlueprint([q({})], softSpec)
  assert.equal(soft.hardViolations, 0)
  assert.equal(soft.softWarnings, 1)
  assert.equal(soft.satisfied, true)
})
