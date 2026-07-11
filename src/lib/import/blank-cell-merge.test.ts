/**
 * Unit tests for the update-mode blank-cell merge (keep vs clear, protected fields, options
 * and asset-ref arrays). Pure logic — no Supabase/Next runtime needed.
 * Run with: node --test --experimental-strip-types "src/lib/import/*.test.ts" (wired to `npm test`).
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { mergeRowWithExisting } from './blank-cell-merge.ts'

function baseRow(overrides = {}) {
  return {
    rowNumber: 1,
    externalId: 'q-1',
    subject: '',
    strand: '',
    topic: '',
    questionType: '',
    variantType: '',
    difficulty: '',
    examType: '',
    marks: '',
    timeLimitSeconds: '',
    answerFormat: '',
    questionText: '',
    passageText: '',
    options: [],
    optionAssetRefsJson: '',
    optionExplanationsJson: '',
    correctAnswer: '',
    workedSolution: '',
    shortExplanation: '',
    stimulusId: '',
    stimulusTitle: '',
    stimulusType: '',
    stimulusText: '',
    stimulusAssetRefs: [],
    questionAssetRefs: [],
    solutionAssetRefs: [],
    inputMethod: '',
    displayMode: '',
    answerValidationJson: '',
    rubricJson: '',
    skillTags: '',
    conceptTags: '',
    status: '',
    tags: '',
    yearLevel: '',
    sourceName: '',
    sourcePaper: '',
    sourceSection: '',
    sourceQuestionNumber: '',
    licenseNotes: '',
    assetGenerationPrompt: '',
    assetAltText: '',
    assetSpecJson: '',
    assetStatus: '',
    assetType: '',
    assetRequired: '',
    domainCode: '',
    subtopicCode: '',
    skillCode: '',
    patternKey: '',
    questionFamily: '',
    stimulusFormat: '',
    stimulusGenre: '',
    assetRenderMethod: '',
    writingForm: '',
    writingPurpose: '',
    writingPromptStimulus: '',
    ...overrides,
  }
}

function baseExisting(overrides = {}) {
  return {
    questionId: 'existing-id',
    subjectId: 'subject-1',
    topicId: 'topic-1',
    questionTypeId: null,
    variantId: null,
    stimulusIdRaw: null,
    externalId: 'q-1',
    subjectName: 'Mathematical Reasoning',
    strand: null,
    topicName: 'Percentages',
    questionTypeName: null,
    variantName: null,
    examType: 'Selective',
    yearLevel: null,
    difficulty: 2,
    marks: 1,
    timeLimitSeconds: null,
    answerFormat: 'single_choice',
    questionText: 'What is 25% of 360?',
    passageText: null,
    options: [
      { label: 'A', text: '60', explanation: null, assetRef: null },
      { label: 'B', text: '75', explanation: null, assetRef: null },
      { label: 'C', text: '90', explanation: null, assetRef: null },
      { label: 'D', text: '120', explanation: null, assetRef: null },
    ],
    correctOptionLabel: 'C',
    workedSolution: 'A quarter of 360 is 90.',
    stimulus: null,
    questionAssetRefs: [],
    solutionAssetRefs: [],
    assetGenerationPrompt: null,
    assetAltText: null,
    assetSpec: null,
    assetStatus: null,
    assetType: null,
    assetRequired: null,
    presentation: {},
    rubric: null,
    skillTags: [],
    conceptTags: [],
    tags: ['percentages'],
    sourceInfo: {},
    status: 'published',
    domainCode: null,
    subtopicCode: null,
    skillCode: null,
    patternKey: null,
    questionFamily: null,
    stimulusFormat: null,
    stimulusGenre: null,
    assetRenderMethod: null,
    writingForm: null,
    writingPurpose: null,
    writingPromptStimulus: null,
    ...overrides,
  }
}

function diffFor(diffs, field) {
  const found = diffs.find((d) => d.field === field)
  assert.ok(found, `expected a diff entry for "${field}"`)
  return found
}

test('blank cell + keep preserves the existing value', () => {
  const row = baseRow({ workedSolution: '' })
  const { mergedRow, diffs } = mergeRowWithExisting(row, baseExisting(), 'keep')
  assert.equal(mergedRow.workedSolution, 'A quarter of 360 is 90.')
  assert.equal(diffFor(diffs, 'workedSolution').changed, false)
})

test('blank cell + clear wipes a non-protected field', () => {
  const row = baseRow({ workedSolution: '' })
  const { mergedRow, diffs } = mergeRowWithExisting(row, baseExisting(), 'clear')
  assert.equal(mergedRow.workedSolution, '')
  assert.equal(diffFor(diffs, 'workedSolution').changed, true)
})

test('non-blank cell always wins regardless of blank-cell setting', () => {
  const row = baseRow({ workedSolution: 'A new explanation.' })
  const keep = mergeRowWithExisting(row, baseExisting(), 'keep').mergedRow
  const clear = mergeRowWithExisting(row, baseExisting(), 'clear').mergedRow
  assert.equal(keep.workedSolution, 'A new explanation.')
  assert.equal(clear.workedSolution, 'A new explanation.')
})

test('protected fields are kept on blank even under "clear" (question text, subject, exam type, answer format, difficulty, correct answer)', () => {
  const row = baseRow({
    questionText: '',
    subject: '',
    examType: '',
    answerFormat: '',
    difficulty: '',
    correctAnswer: '',
    topic: '',
  })
  const { mergedRow } = mergeRowWithExisting(row, baseExisting(), 'clear')
  assert.equal(mergedRow.questionText, 'What is 25% of 360?')
  assert.equal(mergedRow.subject, 'Mathematical Reasoning')
  assert.equal(mergedRow.examType, 'Selective')
  assert.equal(mergedRow.answerFormat, 'single_choice')
  assert.equal(mergedRow.difficulty, '2')
  assert.equal(mergedRow.correctAnswer, 'C')
  assert.equal(mergedRow.topic, 'Percentages')
})

test('status clears to "draft" (not empty) since a blank status is not a valid state', () => {
  const row = baseRow({ status: '' })
  const { mergedRow, diffs } = mergeRowWithExisting(row, baseExisting({ status: 'published' }), 'clear')
  assert.equal(mergedRow.status, 'draft')
  assert.equal(diffFor(diffs, 'status').changed, true)
})

test('status is kept on blank under "keep" so a re-import never silently unpublishes', () => {
  const row = baseRow({ status: '' })
  const { mergedRow } = mergeRowWithExisting(row, baseExisting({ status: 'published' }), 'keep')
  assert.equal(mergedRow.status, 'published')
})

test('blank options (protected array) fall back to the existing options even under "clear"', () => {
  const row = baseRow({ options: ['', '', '', ''] })
  const { mergedRow, diffs } = mergeRowWithExisting(row, baseExisting(), 'clear')
  assert.deepEqual(mergedRow.options, ['60', '75', '90', '120'])
  assert.equal(diffFor(diffs, 'options').changed, false)
})

test('non-blank options fully replace the existing set', () => {
  const row = baseRow({ options: ['10', '20', '30', '40'] })
  const { mergedRow, diffs } = mergeRowWithExisting(row, baseExisting(), 'keep')
  assert.deepEqual(mergedRow.options, ['10', '20', '30', '40'])
  assert.equal(diffFor(diffs, 'options').changed, true)
})

test('blank asset-ref array keeps existing refs under "keep" and clears under "clear"', () => {
  const existing = baseExisting({ questionAssetRefs: ['asset://question-assets/mr-001.svg'] })
  const row = baseRow({ questionAssetRefs: [] })

  const kept = mergeRowWithExisting(row, existing, 'keep').mergedRow
  assert.deepEqual(kept.questionAssetRefs, ['asset://question-assets/mr-001.svg'])

  const cleared = mergeRowWithExisting(row, existing, 'clear').mergedRow
  assert.deepEqual(cleared.questionAssetRefs, [])
})

test('a non-blank asset-ref array always replaces the existing refs', () => {
  const existing = baseExisting({ questionAssetRefs: ['asset://question-assets/mr-001.svg'] })
  const row = baseRow({ questionAssetRefs: ['new-diagram.svg'] })
  const { mergedRow } = mergeRowWithExisting(row, existing, 'keep')
  assert.deepEqual(mergedRow.questionAssetRefs, ['new-diagram.svg'])
})
