/**
 * Unit tests for the pure reading-set core: CSV set/pool grouping, complete-set
 * selection (never split), delayed grading, reveal gating, choices and the
 * shared A–G bank. Zero `@/` value imports so it runs under
 * `node --test --experimental-strip-types` (wired to `npm test`).
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  buildReadingPracticeChoices,
  correctAnswerStatus,
  gradeReadingSet,
  mergeQuestionSetGroups,
  mergeSharedOptionPoolGroups,
  readingItemReveal,
  selectCompleteSets,
  sharedPoolUnusedLabels,
} from './core.ts'
import { readStimulusAttribution } from '../types.ts'
import type { QuestionImportRow } from '../import/types.ts'

const ALL_LABELS = ['A', 'B', 'C', 'D', 'E', 'F', 'G'] as const

/** A blank import row; override only what a test needs. */
function makeRow(overrides: Partial<QuestionImportRow>): QuestionImportRow {
  const base: QuestionImportRow = {
    rowNumber: 1,
    externalId: '',
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
    questionSetId: '',
    questionSetTitle: '',
    questionSetType: '',
    questionOrderInSet: '',
    setInstructions: '',
    setFeedbackMode: '',
    setCompletionMode: '',
    interactionType: '',
    sharedOptionPoolId: '',
    stimulusTargetLabel: '',
    stimulusAuthor: '',
    stimulusSourceTitle: '',
    stimulusSourceUrl: '',
    stimulusAttributionText: '',
  }
  return { ...base, ...overrides }
}

// (5) Multiple questions sharing one question_set_id form ONE set; the
// definition may live on any single row of the group.
test('mergeQuestionSetGroups merges a set definition across its member rows', () => {
  const rows = [
    makeRow({
      externalId: 'q1',
      questionSetId: 'set-1',
      questionSetTitle: 'The Lighthouse',
      questionSetType: 'reading_passage',
      setFeedbackMode: 'after_set',
    }),
    // Second member carries only the id — it must still join the same set.
    makeRow({ externalId: 'q2', questionSetId: 'set-1' }),
  ]

  const groups = mergeQuestionSetGroups(rows)
  assert.equal(groups.size, 1)
  const group = groups.get('set-1')
  assert.ok(group)
  assert.equal(group.title, 'The Lighthouse')
  assert.equal(group.setType, 'reading_passage')
  assert.equal(group.feedbackMode, 'after_set')
})

test('mergeQuestionSetGroups ignores rows with no question_set_id (standalone stays standalone)', () => {
  const rows = [makeRow({ externalId: 'q1' }), makeRow({ externalId: 'q2' })]
  assert.equal(mergeQuestionSetGroups(rows).size, 0)
})

// (11) Sentence insertion: a shared bank of SEVEN options built once.
test('mergeSharedOptionPoolGroups builds one A–G bank from the first row carrying options', () => {
  const seven = ['s1', 's2', 's3', 's4', 's5', 's6', 's7']
  const rows = [
    makeRow({ externalId: 'g23', sharedOptionPoolId: 'pool-1', options: seven }),
    makeRow({ externalId: 'g24', sharedOptionPoolId: 'pool-1', options: seven }),
  ]
  const pools = mergeSharedOptionPoolGroups(rows)
  assert.equal(pools.size, 1)
  assert.deepEqual(pools.get('pool-1')?.optionTexts, seven)
})

// (7) Reading practice selection must select COMPLETE sets, never split one.
test('selectCompleteSets takes whole sets and never splits a set', () => {
  const sets = [
    { setId: 'a', questionIds: ['a1', 'a2', 'a3'] },
    { setId: 'b', questionIds: ['b1', 'b2'] },
    { setId: 'c', questionIds: ['c1', 'c2', 'c3', 'c4'] },
  ]

  const one = selectCompleteSets(sets, 1)
  assert.deepEqual(one.map((s) => s.setId), ['a'])
  assert.deepEqual(one[0].questionIds, ['a1', 'a2', 'a3']) // full set, not a slice

  const two = selectCompleteSets(sets, 2)
  assert.deepEqual(two.map((s) => s.setId), ['a', 'b'])

  const all = selectCompleteSets(sets, 'all')
  assert.equal(all.length, 3)
  // Every chosen set keeps ALL its questions — no partial set anywhere.
  for (const set of all) {
    assert.deepEqual(set.questionIds, sets.find((s) => s.setId === set.setId)!.questionIds)
  }

  // A tiny count still returns a whole set, and never more than exist.
  assert.equal(selectCompleteSets(sets, 99).length, 3)
})

// (6) Ordering within a set is preserved through selection.
test('selectCompleteSets preserves question order within each set', () => {
  const sets = [{ setId: 'a', questionIds: ['q3', 'q1', 'q2'] }]
  assert.deepEqual(selectCompleteSets(sets, 1)[0].questionIds, ['q3', 'q1', 'q2'])
})

// (9) Grading after submission: each child graded individually; unanswered = wrong.
test('gradeReadingSet grades each question individually and counts correctly', () => {
  const graded = gradeReadingSet([
    { questionId: 'q1', selectedLabel: 'B', correctLabel: 'B', workedSolution: 'sol1' },
    { questionId: 'q2', selectedLabel: 'A', correctLabel: 'C', workedSolution: 'sol2' },
    { questionId: 'q3', selectedLabel: null, correctLabel: 'D', workedSolution: 'sol3' },
  ])

  assert.equal(graded.totalQuestions, 3)
  assert.equal(graded.correctCount, 1)
  assert.equal(graded.results[0].isCorrect, true)
  assert.equal(graded.results[1].isCorrect, false)
  assert.equal(graded.results[2].isCorrect, false) // unanswered is incorrect
})

test('gradeReadingSet is deterministic (idempotent) for the same inputs', () => {
  const inputs = [{ questionId: 'q1', selectedLabel: 'B' as const, correctLabel: 'B' as const, workedSolution: 's' }]
  assert.deepEqual(gradeReadingSet(inputs), gradeReadingSet(inputs))
})

// (8) No correctness before submission.
test('readingItemReveal hides correctness/solution until the set is submitted', () => {
  const meta = { isCorrect: true, correctOptionLabel: 'B' as const, workedSolution: 'The answer is B.' }

  const hidden = readingItemReveal(false, meta)
  assert.equal(hidden.isCorrect, null)
  assert.equal(hidden.correctOptionLabel, null)
  assert.equal(hidden.workedSolution, null)

  const shown = readingItemReveal(true, meta)
  assert.equal(shown.isCorrect, true)
  assert.equal(shown.correctOptionLabel, 'B')
  assert.equal(shown.workedSolution, 'The answer is B.')
})

// (3) A–G import + (4) invalid correct_answer referencing a blank option.
test('correctAnswerStatus accepts A–G and rejects labels beyond the populated options', () => {
  const seven = ['a', 'b', 'c', 'd', 'e', 'f', 'g']
  assert.equal(correctAnswerStatus(seven, 'G', ALL_LABELS), 'ok') // A–G supported
  assert.equal(correctAnswerStatus(['a', 'b', 'c', 'd'], 'A', ALL_LABELS), 'ok')

  // Correct answer points beyond the parsed options (blank/absent option).
  assert.equal(correctAnswerStatus(['a', 'b', 'c', 'd'], 'E', ALL_LABELS), 'out_of_range')
  assert.equal(correctAnswerStatus(['a', 'b', 'c', 'd'], 'H', ALL_LABELS), 'not_a_label')
  assert.equal(correctAnswerStatus(['a', 'b', 'c', 'd'], '', ALL_LABELS), 'missing')
})

// (11) One shared option stays unused across the gaps.
test('sharedPoolUnusedLabels leaves exactly the un-assigned options', () => {
  const pool = ['A', 'B', 'C', 'D', 'E', 'F', 'G'] as const
  const assigned = ['B', 'D', 'A', 'F', 'C', 'G'] as const // 6 gaps, 6 assigned
  assert.deepEqual(sharedPoolUnusedLabels([...pool], [...assigned]), ['E'])
})

// (12) Stimulus author + attribution are read from source_info, distinct from
// the question's own source_name/source_paper.
test('readStimulusAttribution extracts author/source and is distinct from question source', () => {
  const attribution = readStimulusAttribution({
    author: 'M. Carrow',
    sourceTitle: 'Coastal Stories',
    sourceUrl: 'https://example.org/x',
    attributionText: 'Adapted with permission.',
    // These belong to the QUESTION, not the passage — must be ignored here.
    sourceName: 'Practice Paper 3',
    sourcePaper: '2024 Sample',
  })
  assert.ok(attribution)
  assert.equal(attribution.author, 'M. Carrow')
  assert.equal(attribution.sourceTitle, 'Coastal Stories')
  assert.equal(attribution.sourceUrl, 'https://example.org/x')
  assert.equal(attribution.attributionText, 'Adapted with permission.')

  // Snake_case keys (as an alternate import shape) are also accepted.
  const snake = readStimulusAttribution({ source_title: 'Coastal Stories', attribution_text: 'Adapted.' })
  assert.equal(snake?.sourceTitle, 'Coastal Stories')

  // No attribution fields → null (nothing to display).
  assert.equal(readStimulusAttribution({}), null)
  assert.equal(readStimulusAttribution(null), null)
})

test('buildReadingPracticeChoices offers 1 / 2 / full with question + time estimates', () => {
  const choices = buildReadingPracticeChoices([9, 6, 8], 60)
  assert.deepEqual(choices.map((c) => c.key), ['1', '2', 'all'])
  assert.equal(choices[0].estimatedQuestions, 9)
  assert.equal(choices[1].estimatedQuestions, 15)
  assert.equal(choices[2].estimatedQuestions, 23)
  assert.equal(choices[0].estimatedMinutes, 9) // 9 questions * 60s = 9 min

  // A single set offers only "1 set" and "full".
  const one = buildReadingPracticeChoices([5], 60)
  assert.deepEqual(one.map((c) => c.key), ['1', 'all'])

  // No sets → no choices.
  assert.deepEqual(buildReadingPracticeChoices([], 60), [])
})
