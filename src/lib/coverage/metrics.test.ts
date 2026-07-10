/**
 * Coverage aggregation tests: counts, distinct patterns/skills, status &
 * asset-ready filtering, difficulty distributions, the usable pool, taxonomy
 * roll-up, and empty-bank behaviour.
 * Run: node --test --experimental-strip-types "src/lib/coverage/*.test.ts"
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { buildSubjectCoverage, coverageStateFor, isUsable, summariseQuestions } from './core.ts'
import type { CoverageQuestion } from './types.ts'
import { getSubject } from '../taxonomy/canonical-taxonomy.ts'

/** buildCoverage lives in queries.ts (needs the DB); here we build directly from taxonomy nodes. */
function buildCoverage(subjectCodes: string[], questions: CoverageQuestion[]) {
  return subjectCodes
    .map((code) => getSubject(code))
    .filter((node) => node !== null)
    .map((node) => buildSubjectCoverage(node!, questions))
}

let seq = 0
function q(overrides: Partial<CoverageQuestion> = {}): CoverageQuestion {
  seq += 1
  return {
    id: `q${seq}`,
    subjectCode: 'mathematical_reasoning',
    domainCode: 'number_algebra',
    subtopicCode: 'fractions',
    skillCode: null,
    patternKey: null,
    questionFamily: null,
    stimulusFormat: null,
    difficulty: 3,
    status: 'published',
    validationStatus: 'validated',
    examType: 'Selective',
    yearLevel: 6,
    tags: [],
    assetReady: true,
    hasMissingAsset: false,
    usedInMockRecently: false,
    hasCanonicalTaxonomy: true,
    unresolvedCodes: [],
    ...overrides,
  }
}

test('summariseQuestions counts totals and status breakdown', () => {
  const m = summariseQuestions([
    q({ status: 'draft', validationStatus: 'unreviewed' }),
    q({ status: 'reviewed', validationStatus: 'unreviewed' }),
    q({ status: 'published' }),
    q({ status: 'published' }),
    q({ status: 'archived' }),
  ])
  assert.equal(m.total, 5)
  assert.equal(m.draft, 1)
  assert.equal(m.reviewed, 1)
  assert.equal(m.published, 2)
  assert.equal(m.archived, 1)
})

test('usable pool = validated AND published AND asset-ready', () => {
  const usable = q()
  assert.equal(isUsable(usable), true)
  assert.equal(isUsable(q({ validationStatus: 'unreviewed' })), false)
  assert.equal(isUsable(q({ status: 'draft' })), false)
  assert.equal(isUsable(q({ assetReady: false })), false)

  const m = summariseQuestions([
    q(), // usable
    q(), // usable
    q({ validationStatus: 'needs_fixes' }), // published + asset-ready but not validated
    q({ status: 'draft' }), // validated + asset-ready but not published
    q({ assetReady: false, hasMissingAsset: true }), // validated + published but asset not ready
  ])
  assert.equal(m.usable, 2)
  // validatedPublished ignores the asset requirement → 3 (the two usable + the asset-missing one)
  assert.equal(m.validatedPublished, 3)
  assert.equal(m.assetReady, 4)
  assert.equal(m.missingAssets, 1)
})

test('distinct pattern keys and skills count only non-null codes; usable variants use the usable pool only', () => {
  const m = summariseQuestions([
    q({ patternKey: 'p1', skillCode: 's1' }),
    q({ patternKey: 'p1', skillCode: 's2' }), // same pattern, different skill
    q({ patternKey: 'p2', skillCode: 's1' }),
    q({ patternKey: null, skillCode: null }),
    // published but not validated: contributes to distinctPatternKeys but NOT usablePatternKeys
    q({ patternKey: 'p3', validationStatus: 'unreviewed' }),
  ])
  assert.equal(m.distinctPatternKeys, 3) // p1, p2, p3
  assert.equal(m.usablePatternKeys, 2) // p1, p2 (p3 not usable)
  assert.equal(m.distinctSkills, 2) // s1, s2
  assert.deepEqual(m.patternKeys, ['p1', 'p2', 'p3'])
  assert.deepEqual(m.skillCodes, ['s1', 's2'])
})

test('difficulty distribution buckets 1–5 and the usable pool separately', () => {
  const m = summariseQuestions([
    q({ difficulty: 1 }),
    q({ difficulty: 2 }),
    q({ difficulty: 3 }),
    q({ difficulty: 4 }),
    q({ difficulty: 5 }),
    q({ difficulty: null }),
    q({ difficulty: 5, status: 'draft' }), // hard but not usable
  ])
  assert.deepEqual(m.difficulty, { easy: 2, medium: 1, hard: 3, unknown: 1 })
  // usable excludes the draft hard question and the (unreviewed? no) — only the draft one is non-usable here
  assert.deepEqual(m.usableDifficulty, { easy: 2, medium: 1, hard: 2, unknown: 1 })
})

test('recently-used-in-mocks is counted', () => {
  const m = summariseQuestions([
    q({ usedInMockRecently: true }),
    q({ usedInMockRecently: true }),
    q({ usedInMockRecently: false }),
  ])
  assert.equal(m.recentlyUsedInMocks, 2)
})

test('empty bank yields all-zero metrics and a critical state', () => {
  const m = summariseQuestions([])
  assert.equal(m.total, 0)
  assert.equal(m.usable, 0)
  assert.equal(m.distinctPatternKeys, 0)
  assert.deepEqual(m.difficulty, { easy: 0, medium: 0, hard: 0, unknown: 0 })
  assert.equal(coverageStateFor(m), 'critical')
})

test('buildCoverage groups by canonical taxonomy and includes empty subtopics', () => {
  const [subject] = buildCoverage(
    ['mathematical_reasoning'],
    [
      q({ subtopicCode: 'fractions', patternKey: 'p1' }),
      q({ subtopicCode: 'fractions', patternKey: 'p2' }),
      q({ subtopicCode: 'decimals', patternKey: 'p1' }),
    ]
  )
  assert.equal(subject.code, 'mathematical_reasoning')
  assert.equal(subject.metrics.total, 3)

  const numberAlgebra = subject.domains.find((d) => d.code === 'number_algebra')
  assert.ok(numberAlgebra, 'number_algebra domain exists')
  assert.equal(numberAlgebra!.metrics.total, 3)

  const fractions = numberAlgebra!.subtopics.find((s) => s.code === 'fractions')
  const decimals = numberAlgebra!.subtopics.find((s) => s.code === 'decimals')
  assert.equal(fractions!.metrics.total, 2)
  assert.equal(decimals!.metrics.total, 1)

  // A subtopic with no questions still appears with zero metrics (drives audit).
  const emptyOne = numberAlgebra!.subtopics.find((s) => s.metrics.total === 0)
  assert.ok(emptyOne, 'at least one empty subtopic is present')
})

test('buildCoverage counts domain questions not assigned to any subtopic', () => {
  const [subject] = buildCoverage(
    ['mathematical_reasoning'],
    [q({ subtopicCode: null, domainCode: 'number_algebra' })]
  )
  const numberAlgebra = subject.domains.find((d) => d.code === 'number_algebra')
  assert.equal(numberAlgebra!.metrics.total, 1)
  assert.equal(numberAlgebra!.unassignedToSubtopic, 1)
})
