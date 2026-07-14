/**
 * Coverage-state threshold + difficulty-band tests.
 * Run: node --test --experimental-strip-types "src/lib/coverage/*.test.ts"
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  computeCoverageState,
  difficultyBand,
  hasHealthyDifficulty,
  hasReasonableDifficulty,
  type DifficultyBandCounts,
} from './core.ts'

function bands(easy: number, medium: number, hard: number, unknown = 0): DifficultyBandCounts {
  return { easy, medium, hard, unknown }
}

test('difficultyBand maps the 1–5 scale onto easy/medium/hard', () => {
  assert.equal(difficultyBand(1), 'easy')
  assert.equal(difficultyBand(2), 'easy')
  assert.equal(difficultyBand(3), 'medium')
  assert.equal(difficultyBand(4), 'hard')
  assert.equal(difficultyBand(5), 'hard')
  assert.equal(difficultyBand(null), null)
  assert.equal(difficultyBand(undefined), null)
  assert.equal(difficultyBand(NaN), null)
})

test('hasReasonableDifficulty requires every band present', () => {
  assert.equal(hasReasonableDifficulty(bands(1, 1, 1)), true)
  assert.equal(hasReasonableDifficulty(bands(5, 5, 0)), false)
  assert.equal(hasReasonableDifficulty(bands(0, 1, 1)), false)
})

test('hasHealthyDifficulty requires a balanced spread (>=10% per band)', () => {
  // 40 usable → each band must hold at least ceil(40*0.1)=4.
  assert.equal(hasHealthyDifficulty(40, bands(14, 13, 13)), true)
  assert.equal(hasHealthyDifficulty(40, bands(36, 3, 1)), false) // hard below 4
  // Small pools: floor of 1 per band.
  assert.equal(hasHealthyDifficulty(3, bands(1, 1, 1)), true)
})

test('critical: fewer than 8 usable OR fewer than 3 pattern keys', () => {
  assert.equal(
    computeCoverageState({ usableCount: 7, usablePatternKeys: 20, usableDifficulty: bands(3, 2, 2) }),
    'critical'
  )
  assert.equal(
    computeCoverageState({ usableCount: 50, usablePatternKeys: 2, usableDifficulty: bands(20, 15, 15) }),
    'critical'
  )
})

test('limited: 8–19 usable, or 3–4 pattern keys (not critical, below healthy floor)', () => {
  assert.equal(
    computeCoverageState({ usableCount: 8, usablePatternKeys: 3, usableDifficulty: bands(3, 3, 2) }),
    'limited'
  )
  assert.equal(
    computeCoverageState({ usableCount: 19, usablePatternKeys: 8, usableDifficulty: bands(7, 6, 6) }),
    'limited'
  )
  assert.equal(
    computeCoverageState({ usableCount: 30, usablePatternKeys: 4, usableDifficulty: bands(10, 10, 10) }),
    'limited'
  )
})

test('healthy: 20+ usable, 5+ patterns, every difficulty covered', () => {
  assert.equal(
    computeCoverageState({ usableCount: 20, usablePatternKeys: 5, usableDifficulty: bands(8, 7, 5) }),
    'healthy'
  )
})

test('healthy downgrades to limited when a difficulty band is empty', () => {
  assert.equal(
    computeCoverageState({ usableCount: 25, usablePatternKeys: 6, usableDifficulty: bands(20, 5, 0) }),
    'limited'
  )
})

test('strong: 40+ usable, 10+ patterns, balanced difficulty', () => {
  assert.equal(
    computeCoverageState({ usableCount: 40, usablePatternKeys: 10, usableDifficulty: bands(14, 13, 13) }),
    'strong'
  )
})

test('strong downgrades to healthy when volume, diversity, or balance falls short', () => {
  // usable below 40
  assert.equal(
    computeCoverageState({ usableCount: 39, usablePatternKeys: 12, usableDifficulty: bands(13, 13, 13) }),
    'healthy'
  )
  // fewer than 10 patterns
  assert.equal(
    computeCoverageState({ usableCount: 60, usablePatternKeys: 9, usableDifficulty: bands(20, 20, 20) }),
    'healthy'
  )
  // unbalanced difficulty (hard below 10%)
  assert.equal(
    computeCoverageState({ usableCount: 50, usablePatternKeys: 15, usableDifficulty: bands(45, 4, 1) }),
    'healthy'
  )
})

test('empty bank is critical', () => {
  assert.equal(
    computeCoverageState({ usableCount: 0, usablePatternKeys: 0, usableDifficulty: bands(0, 0, 0) }),
    'critical'
  )
})
