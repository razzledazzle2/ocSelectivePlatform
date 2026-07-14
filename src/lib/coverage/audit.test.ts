/**
 * Current-bank audit tests: missing subtopics, poor pattern diversity, missing
 * hard questions, missing asset-ready questions, and legacy/untaxonomised rows.
 * Run: node --test --experimental-strip-types "src/lib/coverage/*.test.ts"
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { auditCoverage, buildSubjectCoverage } from './core.ts'
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

function buildAudit(questions: CoverageQuestion[]) {
  const subjects = buildCoverage(['mathematical_reasoning', 'thinking_skills'], questions)
  return { subjects, audit: auditCoverage(subjects, questions) }
}

test('missingSubtopics lists taxonomy subtopics with zero questions', () => {
  const { audit } = buildAudit([q({ subtopicCode: 'fractions' })])
  assert.ok(audit.missingSubtopics.length > 0)
  // fractions has a question, so it must NOT be flagged as missing.
  assert.ok(!audit.missingSubtopics.some((s) => s.subtopicCode === 'fractions'))
  // decimals has none, so it must be flagged.
  assert.ok(audit.missingSubtopics.some((s) => s.subtopicCode === 'decimals'))
})

test('poorPatternDiversity flags a populated subtopic below the pattern floor', () => {
  const { audit } = buildAudit([
    q({ subtopicCode: 'fractions', patternKey: 'p1' }),
    q({ subtopicCode: 'fractions', patternKey: 'p1' }),
    q({ subtopicCode: 'fractions', patternKey: 'p2' }),
  ])
  const flagged = audit.poorPatternDiversity.find((s) => s.subtopicCode === 'fractions')
  assert.ok(flagged, 'fractions flagged for poor diversity')
  assert.equal(flagged!.value, 2) // 2 distinct patterns < 5
})

test('lackingHardQuestions flags a populated subtopic with no difficulty 4–5', () => {
  const { audit } = buildAudit([
    q({ subtopicCode: 'fractions', difficulty: 1 }),
    q({ subtopicCode: 'fractions', difficulty: 3 }),
  ])
  assert.ok(audit.lackingHardQuestions.some((s) => s.subtopicCode === 'fractions'))
})

test('lackingAssetReady flags a populated subtopic with zero asset-ready questions', () => {
  const { audit } = buildAudit([
    q({ subtopicCode: 'fractions', assetReady: false, hasMissingAsset: true }),
  ])
  assert.ok(audit.lackingAssetReady.some((s) => s.subtopicCode === 'fractions'))
})

test('missingCanonicalTaxonomy and legacyValuesForReview count untaxonomised / stale rows', () => {
  const { audit } = buildAudit([
    q(), // fine
    q({ hasCanonicalTaxonomy: false, subtopicCode: null }), // untaxonomised
    q({ unresolvedCodes: ['old_subtopic_code'] }), // legacy/stale code
  ])
  assert.equal(audit.missingCanonicalTaxonomy, 1)
  assert.equal(audit.legacyValuesForReview, 1)
})

test('audit does not mutate the input questions', () => {
  const input = [q({ subtopicCode: 'fractions' })]
  const snapshot = JSON.parse(JSON.stringify(input))
  buildAudit(input)
  assert.deepEqual(input, snapshot)
})
