/**
 * Subtopic mastery policy tests: attempt gates, pattern-diversity gates,
 * difficulty + recency weighting, repeated-attempt caps, mastered / needs-review
 * transitions, legacy attempts, roll-ups, recommendations and targeted-practice
 * selection (including an empty bank).
 * Run: node --test --experimental-strip-types "src/lib/mastery/*.test.ts"
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  MASTERY_GATES,
  MASTERY_THRESHOLDS,
  buildSubjectMastery,
  computeMasteryState,
  computeSubtopicMastery,
  difficultyPerformance,
  difficultyWeight,
  everReachedMastered,
  evidenceKey,
  progressPercent,
  rankRecommendations,
  recencyWeight,
  recentAccuracy,
  selectTargetedPractice,
  selectValidAttempts,
  targetDifficultyBand,
  weightedPerformance,
  type PracticeCandidate,
} from './core.ts'
import { getSubject } from '../taxonomy/canonical-taxonomy.ts'
import type { MasteryAttempt, SubtopicMastery } from './types.ts'

const SUBTOPIC = {
  code: 'area_and_perimeter',
  label: 'Area and perimeter',
  domainCode: 'measurement_financial',
  subjectCode: 'mathematical_reasoning',
}

const BASE_TIME = Date.parse('2026-07-01T00:00:00.000Z')

/** Attempts are generated oldest → newest, one minute apart. */
function attempt(index: number, overrides: Partial<MasteryAttempt> = {}): MasteryAttempt {
  return {
    questionId: `q${index}`,
    isCorrect: true,
    difficulty: 3,
    skillCode: `skill${index}`,
    patternKey: `pattern${index}`,
    attemptedAt: new Date(BASE_TIME + index * 60_000).toISOString(),
    ...overrides,
  }
}

/** `count` attempts, each on its own question/pattern, with a fixed correctness. */
function attempts(count: number, overrides: (index: number) => Partial<MasteryAttempt> = () => ({})) {
  return Array.from({ length: count }, (_, index) => attempt(index + 1, overrides(index + 1)))
}

/* -------------------------------------------------------------------------- */
/* No attempts                                                                 */
/* -------------------------------------------------------------------------- */

test('a subtopic with no attempts is not_started and has no score', () => {
  const mastery = computeSubtopicMastery(SUBTOPIC, [])
  assert.equal(mastery.state, 'not_started')
  assert.equal(mastery.masteryPercent, null)
  assert.equal(mastery.recentAccuracy, null)
  assert.equal(mastery.attemptCount, 0)
  assert.equal(mastery.validAttemptCount, 0)
  assert.equal(mastery.lastPractisedAt, null)
  assert.equal(mastery.evidenceGap, null)
})

/* -------------------------------------------------------------------------- */
/* Minimum-attempt and pattern-diversity gates                                 */
/* -------------------------------------------------------------------------- */

test('fewer than the minimum attempts stays in learning however perfect', () => {
  const mastery = computeSubtopicMastery(SUBTOPIC, attempts(MASTERY_GATES.minAttempts - 1))
  assert.equal(mastery.state, 'learning')
  assert.equal(mastery.masteryPercent, 100)
  assert.deepEqual(mastery.evidenceGap, { attemptsNeeded: 1, patternsNeeded: 0 })
})

test('enough attempts but too few distinct patterns stays in learning', () => {
  // 10 perfect attempts across only 2 patterns (and 10 distinct questions).
  const history = attempts(10, (index) => ({ patternKey: `pattern${index % 2}` }))
  const mastery = computeSubtopicMastery(SUBTOPIC, history)
  assert.equal(mastery.state, 'learning')
  assert.equal(mastery.distinctPatterns, 2)
  assert.deepEqual(mastery.evidenceGap, { attemptsNeeded: 0, patternsNeeded: 1 })
})

test('questions with no pattern key fall back to per-question evidence keys', () => {
  assert.equal(evidenceKey({ questionId: 'q1', patternKey: null }), 'question:q1')
  assert.equal(evidenceKey({ questionId: 'q1', patternKey: 'p' }), 'pattern:p')

  // An unlabelled bank must not strand every student in `learning` forever.
  const history = attempts(8, () => ({ patternKey: null }))
  const mastery = computeSubtopicMastery(SUBTOPIC, history)
  assert.equal(mastery.distinctPatterns, 8)
  assert.equal(mastery.state, 'mastered')
})

/* -------------------------------------------------------------------------- */
/* Weighting                                                                   */
/* -------------------------------------------------------------------------- */

test('difficulty weights follow the easy/medium/hard bands, unknown as medium', () => {
  assert.equal(difficultyWeight(1), 0.85)
  assert.equal(difficultyWeight(2), 0.85)
  assert.equal(difficultyWeight(3), 1.0)
  assert.equal(difficultyWeight(4), 1.15)
  assert.equal(difficultyWeight(5), 1.15)
  assert.equal(difficultyWeight(null), 1.0)
})

test('recency weights step down by rank band', () => {
  assert.equal(recencyWeight(1), 1.0)
  assert.equal(recencyWeight(5), 1.0)
  assert.equal(recencyWeight(6), 0.8)
  assert.equal(recencyWeight(10), 0.8)
  assert.equal(recencyWeight(11), 0.55)
  assert.equal(recencyWeight(20), 0.55)
  assert.equal(recencyWeight(21), 0.3)
  assert.equal(recencyWeight(500), 0.3)
})

test('a recent correct answer counts far more than an old one', () => {
  // Oldest wrong, newest right vs the reverse — same attempts, opposite order.
  const improving = [
    attempt(1, { isCorrect: false, attemptedAt: new Date(BASE_TIME).toISOString() }),
    attempt(2, { isCorrect: true, attemptedAt: new Date(BASE_TIME + 60_000).toISOString() }),
  ]
  const declining = [
    attempt(1, { isCorrect: true, attemptedAt: new Date(BASE_TIME).toISOString() }),
    attempt(2, { isCorrect: false, attemptedAt: new Date(BASE_TIME + 60_000).toISOString() }),
  ]
  // Ranks 1 and 2 share the same recency band, so equal weights here...
  assert.equal(weightedPerformance(selectValidAttempts(improving)), 50)
  assert.equal(weightedPerformance(selectValidAttempts(declining)), 50)

  // ...but across bands the newest window dominates: 5 recent right, 5 old wrong.
  const recentRight = attempts(10, (index) => ({ isCorrect: index > 5 }))
  const score = weightedPerformance(selectValidAttempts(recentRight))!
  assert.ok(score > 50, `expected recent-weighted score above 50, got ${score}`)
})

test('hard questions carry more weight than easy ones', () => {
  const hardRight = attempts(6, (index) => ({ difficulty: index <= 3 ? 5 : 1, isCorrect: index <= 3 }))
  const easyRight = attempts(6, (index) => ({ difficulty: index <= 3 ? 1 : 5, isCorrect: index <= 3 }))
  // Same count correct; getting the HARD ones right must score higher.
  assert.ok(weightedPerformance(selectValidAttempts(hardRight))! > weightedPerformance(selectValidAttempts(easyRight))!)
})

/* -------------------------------------------------------------------------- */
/* Repeated attempts on the same question / pattern                            */
/* -------------------------------------------------------------------------- */

test('repeated attempts on one question cannot inflate mastery', () => {
  // 20 correct attempts, all on the same question and pattern.
  const grind = attempts(20, () => ({ questionId: 'q1', patternKey: 'p1', skillCode: 's1' }))
  const valid = selectValidAttempts(grind)

  assert.equal(valid.length, 2, 'at most two attempts per question count')
  const mastery = computeSubtopicMastery(SUBTOPIC, grind)
  assert.equal(mastery.attemptCount, 20, 'raw history is preserved')
  assert.equal(mastery.validAttemptCount, 2)
  assert.equal(mastery.distinctPatterns, 1)
  assert.equal(mastery.state, 'learning')
})

test('grinding one pattern across many questions is capped', () => {
  const grind = attempts(30, () => ({ patternKey: 'p1' }))
  const valid = selectValidAttempts(grind)
  assert.equal(valid.length, 6, 'at most six attempts per evidence key count')
  assert.equal(computeSubtopicMastery(SUBTOPIC, grind).state, 'learning')
})

test('the newest attempts are the ones kept when a cap bites', () => {
  const history = [
    attempt(1, { questionId: 'q1', isCorrect: false }),
    attempt(2, { questionId: 'q1', isCorrect: false }),
    attempt(3, { questionId: 'q1', isCorrect: true }),
  ]
  const valid = selectValidAttempts(history)
  assert.equal(valid.length, 2)
  assert.deepEqual(
    valid.map((item) => item.isCorrect),
    [true, false],
    'newest first: the latest attempt and the one before it'
  )
})

/* -------------------------------------------------------------------------- */
/* State transitions                                                           */
/* -------------------------------------------------------------------------- */

test('developing when weighted performance is below the proficient floor', () => {
  const history = attempts(10, (index) => ({ isCorrect: index % 2 === 0 }))
  const mastery = computeSubtopicMastery(SUBTOPIC, history)
  assert.equal(mastery.state, 'developing')
  assert.ok(mastery.masteryPercent! < MASTERY_THRESHOLDS.proficient)
})

test('proficient between the proficient floor and the mastered bar', () => {
  // 8 of 10 correct, with the two misses recent enough to hold it under 85.
  const history = attempts(10, (index) => ({ isCorrect: index !== 9 && index !== 10 }))
  const mastery = computeSubtopicMastery(SUBTOPIC, history)
  assert.equal(mastery.state, 'proficient')
  assert.ok(mastery.masteryPercent! >= MASTERY_THRESHOLDS.proficient)
  assert.ok(mastery.masteryPercent! < MASTERY_THRESHOLDS.mastered)
})

test('mastered needs performance, attempts, patterns and recent accuracy together', () => {
  const mastery = computeSubtopicMastery(SUBTOPIC, attempts(8))
  assert.equal(mastery.state, 'mastered')
  assert.equal(mastery.masteryPercent, 100)
  assert.equal(mastery.everMastered, true)

  // One attempt short of the mastered gate → proficient, not mastered.
  const short = computeSubtopicMastery(SUBTOPIC, attempts(7))
  assert.equal(short.validAttemptCount, 7)
  assert.equal(short.state, 'proficient')

  // Enough attempts, but only 4 distinct patterns → cannot be mastered.
  const narrow = computeSubtopicMastery(
    SUBTOPIC,
    attempts(12, (index) => ({ patternKey: `pattern${index % 4}` }))
  )
  assert.equal(narrow.distinctPatterns, 4)
  assert.equal(narrow.state, 'proficient')
})

test('strong history with weak recent answers cannot be mastered', () => {
  // 20 correct, then 5 wrong: recent accuracy 50% blocks the mastered bar.
  const history = attempts(25, (index) => ({ isCorrect: index <= 20 }))
  const mastery = computeSubtopicMastery(SUBTOPIC, history)
  assert.equal(mastery.recentAccuracy, 50)
  assert.notEqual(mastery.state, 'mastered')
})

test('a previously mastered subtopic falls to needs_review when recent work slips', () => {
  const history = [
    ...attempts(12), // clears the mastered bar
    ...Array.from({ length: 6 }, (_, index) =>
      attempt(100 + index, { isCorrect: false, attemptedAt: new Date(BASE_TIME + (200 + index) * 60_000).toISOString() })
    ),
  ]
  const mastery = computeSubtopicMastery(SUBTOPIC, history)
  assert.equal(mastery.everMastered, true)
  assert.ok(mastery.recentAccuracy! < MASTERY_THRESHOLDS.needsReviewRecent)
  assert.equal(mastery.state, 'needs_review')
})

test('needs_review requires having been mastered before, not just a bad run', () => {
  const neverMastered = attempts(12, (index) => ({ isCorrect: index % 3 === 0 }))
  const mastery = computeSubtopicMastery(SUBTOPIC, neverMastered)
  assert.equal(mastery.everMastered, false)
  assert.equal(mastery.state, 'developing')
})

test('everReachedMastered replays the history rather than reading the present', () => {
  const nowPerfect = attempts(8)
  assert.equal(everReachedMastered(nowPerfect), true)

  const neverEnough = attempts(4)
  assert.equal(everReachedMastered(neverEnough), false)
})

test('computeMasteryState is the single source of truth for the ladder', () => {
  const base = { validAttempts: 10, distinctPatterns: 6, weighted: 90, recent: 90 }
  assert.equal(computeMasteryState(base, false), 'mastered')
  assert.equal(computeMasteryState({ ...base, weighted: 70 }, false), 'proficient')
  assert.equal(computeMasteryState({ ...base, weighted: 40 }, false), 'developing')
  assert.equal(computeMasteryState({ ...base, validAttempts: 3 }, false), 'learning')
  assert.equal(computeMasteryState({ ...base, distinctPatterns: 2 }, false), 'learning')
  assert.equal(computeMasteryState({ ...base, recent: 60, weighted: 88 }, true), 'needs_review')
  assert.equal(
    computeMasteryState({ validAttempts: 0, distinctPatterns: 0, weighted: null, recent: null }, false),
    'not_started'
  )
})

/* -------------------------------------------------------------------------- */
/* Legacy attempts                                                             */
/* -------------------------------------------------------------------------- */

test('legacy attempts with no difficulty or skill still count as evidence', () => {
  const legacy = attempts(8, () => ({ difficulty: null, skillCode: null }))
  const mastery = computeSubtopicMastery(SUBTOPIC, legacy)
  assert.equal(mastery.validAttemptCount, 8)
  assert.equal(mastery.distinctSkills, 0)
  assert.equal(mastery.state, 'mastered', 'a null difficulty weights as medium, never drops the row')
})

test('recent accuracy stays null until the minimum window is reached', () => {
  assert.equal(recentAccuracy(selectValidAttempts(attempts(2))), null)
  assert.equal(recentAccuracy(selectValidAttempts(attempts(3))), 100)
})

test('difficulty performance reports null accuracy for untouched bands', () => {
  const rows = difficultyPerformance(attempts(2, () => ({ difficulty: 5 })))
  assert.deepEqual(rows.map((row) => row.band), ['easy', 'medium', 'hard'])
  assert.equal(rows[0].accuracy, null)
  assert.equal(rows[2].accuracy, 100)
})

/* -------------------------------------------------------------------------- */
/* Roll-up                                                                     */
/* -------------------------------------------------------------------------- */

test('progress counts unattempted subtopics as zero', () => {
  const rows = [{ masteryPercent: 100 }, { masteryPercent: null }] as SubtopicMastery[]
  assert.equal(progressPercent(rows), 50)
  assert.equal(progressPercent([]), 0)
})

test('the subject tree keeps every taxonomy subtopic, attempted or not', () => {
  const subject = getSubject('mathematical_reasoning')!
  const mastery = buildSubjectMastery(subject, new Map([['area_and_perimeter', attempts(8)]]))

  assert.equal(mastery.subjectCode, 'mathematical_reasoning')
  assert.equal(mastery.domains.length, subject.domains.length)
  assert.equal(mastery.subtopicCount, subject.domains.reduce((sum, d) => sum + d.subtopics.length, 0))
  assert.equal(mastery.masteredCount, 1)
  assert.equal(mastery.startedSubtopicCount, 1)
  assert.equal(mastery.attemptCount, 8)

  const measurement = mastery.domains.find((domain) => domain.domainCode === 'measurement_financial')!
  const area = measurement.subtopics.find((s) => s.subtopicCode === 'area_and_perimeter')!
  assert.equal(area.state, 'mastered')
  assert.equal(area.domainLabel, 'Measurement and Financial Mathematics')
  assert.equal(
    measurement.subtopics.filter((s) => s.state === 'not_started').length,
    measurement.subtopicCount - 1
  )
})

test('an empty attempt history produces a zero-progress, all-not_started tree', () => {
  const subject = getSubject('thinking_skills')!
  const mastery = buildSubjectMastery(subject, new Map())
  assert.equal(mastery.progressPercent, 0)
  assert.equal(mastery.startedSubtopicCount, 0)
  assert.equal(mastery.recentAccuracy, null)
  assert.ok(mastery.domains.every((domain) => domain.subtopics.every((s) => s.state === 'not_started')))
})

/* -------------------------------------------------------------------------- */
/* Recommendations                                                             */
/* -------------------------------------------------------------------------- */

function masteryRow(overrides: Partial<SubtopicMastery>): SubtopicMastery {
  return {
    subtopicCode: 'x',
    subtopicLabel: 'X',
    domainCode: 'd',
    domainLabel: 'D',
    subjectCode: 'mathematical_reasoning',
    state: 'not_started',
    masteryPercent: null,
    attemptCount: 0,
    validAttemptCount: 0,
    recentAccuracy: null,
    distinctPatterns: 0,
    distinctSkills: 0,
    lastPractisedAt: null,
    everMastered: false,
    evidenceGap: null,
    ...overrides,
  }
}

test('recommendations put needs_review first and never suggest an empty subtopic', () => {
  const now = BASE_TIME + 30 * 24 * 60 * 60 * 1000
  const ranked = rankRecommendations(
    [
      { mastery: masteryRow({ subtopicCode: 'fresh' }), availableQuestions: 10, importance: 1 },
      {
        mastery: masteryRow({ subtopicCode: 'weak', state: 'developing', recentAccuracy: 40 }),
        availableQuestions: 10,
        importance: 2,
      },
      {
        mastery: masteryRow({ subtopicCode: 'slipped', state: 'needs_review', recentAccuracy: 55, everMastered: true }),
        availableQuestions: 10,
        importance: 3,
      },
      { mastery: masteryRow({ subtopicCode: 'empty', state: 'developing' }), availableQuestions: 0, importance: 0 },
    ],
    { now, limit: 4 }
  )

  assert.deepEqual(ranked.map((row) => row.subtopicCode), ['slipped', 'weak', 'fresh'])
  assert.ok(!ranked.some((row) => row.subtopicCode === 'empty'), 'a subtopic with no questions is not recommended')
  assert.ok(ranked[0].reason.length > 0)
})

test('a subtopic just practised is held back from the recommendations', () => {
  const now = BASE_TIME + 60 * 60 * 1000 // one hour later
  const justPractised = {
    mastery: masteryRow({
      subtopicCode: 'just_done',
      state: 'developing',
      recentAccuracy: 30,
      lastPractisedAt: new Date(BASE_TIME).toISOString(),
    }),
    availableQuestions: 10,
    importance: 1,
  }
  const other = {
    mastery: masteryRow({ subtopicCode: 'other', state: 'developing', recentAccuracy: 60 }),
    availableQuestions: 10,
    importance: 2,
  }

  assert.deepEqual(
    rankRecommendations([justPractised, other], { now }).map((row) => row.subtopicCode),
    ['other'],
    'the cooldown keeps the just-completed set from being recommended again'
  )

  // When everything is cooling down we still recommend rather than show nothing.
  assert.deepEqual(
    rankRecommendations([justPractised], { now }).map((row) => row.subtopicCode),
    ['just_done']
  )
})

test('a long-untouched mastered subtopic resurfaces for a refresher', () => {
  const now = BASE_TIME + 90 * 24 * 60 * 60 * 1000
  const stale = {
    mastery: masteryRow({
      subtopicCode: 'stale',
      state: 'mastered',
      recentAccuracy: 95,
      lastPractisedAt: new Date(BASE_TIME).toISOString(),
      everMastered: true,
    }),
    availableQuestions: 10,
    importance: 1,
  }
  const freshlyMastered = {
    mastery: masteryRow({
      subtopicCode: 'warm',
      state: 'mastered',
      recentAccuracy: 95,
      lastPractisedAt: new Date(now - 2 * 24 * 60 * 60 * 1000).toISOString(),
      everMastered: true,
    }),
    availableQuestions: 10,
    importance: 2,
  }
  const ranked = rankRecommendations([freshlyMastered, stale], { now, limit: 2 })
  assert.equal(ranked[0].subtopicCode, 'stale')
  assert.match(ranked[0].reason, /refresher/i)
})

/* -------------------------------------------------------------------------- */
/* Targeted practice selection                                                 */
/* -------------------------------------------------------------------------- */

function candidate(id: string, overrides: Partial<PracticeCandidate> = {}): PracticeCandidate {
  return { id, difficulty: 3, skillCode: null, patternKey: id, recentAttemptRank: null, ...overrides }
}

test('an empty question bank yields an empty, honest selection', () => {
  const selection = selectTargetedPractice([], { count: 10, recentAccuracy: null })
  assert.deepEqual(selection.questionIds, [])
  assert.equal(selection.limited, true)
  assert.match(selection.notice!, /no practice-ready questions/i)
})

test('selection prefers varied patterns and skills before repeating either', () => {
  const pool = [
    candidate('a', { patternKey: 'p1', skillCode: 's1' }),
    candidate('b', { patternKey: 'p1', skillCode: 's1' }),
    candidate('c', { patternKey: 'p2', skillCode: 's2' }),
    candidate('d', { patternKey: 'p3', skillCode: 's3' }),
  ]
  const selection = selectTargetedPractice(pool, { count: 3, recentAccuracy: 70 })

  assert.equal(selection.questionIds.length, 3)
  assert.equal(selection.distinctPatterns, 3)
  assert.equal(selection.distinctSkills, 3)
  assert.equal(selection.limited, false)
  assert.equal(selection.notice, null)
})

test('recently attempted questions are avoided, then used only to top up', () => {
  const pool = [
    candidate('justSeen', { recentAttemptRank: 1 }),
    candidate('seenEarlier', { recentAttemptRank: 15 }),
    candidate('fresh', { recentAttemptRank: null }),
  ]

  const small = selectTargetedPractice(pool, { count: 1, recentAccuracy: null })
  assert.deepEqual(small.questionIds, ['fresh'], 'never an immediate repeat while fresh questions exist')

  const topUp = selectTargetedPractice(pool, { count: 3, recentAccuracy: null, avoidRecentAttempts: 20 })
  assert.equal(topUp.questionIds[0], 'fresh')
  assert.equal(topUp.questionIds.length, 3)
  assert.ok(
    topUp.questionIds.indexOf('seenEarlier') < topUp.questionIds.indexOf('justSeen'),
    'the least recently seen repeat is reached for first'
  )

  // A question seen long ago (outside the window) is not treated as a repeat.
  const stale = selectTargetedPractice([candidate('old', { recentAttemptRank: 40 })], {
    count: 1,
    recentAccuracy: null,
    avoidRecentAttempts: 20,
  })
  assert.deepEqual(stale.questionIds, ['old'])
})

test('difficulty adapts modestly to recent performance without filtering the pool', () => {
  assert.equal(targetDifficultyBand(null), 'medium')
  assert.equal(targetDifficultyBand(90), 'hard')
  assert.equal(targetDifficultyBand(70), 'medium')
  assert.equal(targetDifficultyBand(40), 'easy')

  const pool = [candidate('easy', { difficulty: 1 }), candidate('hard', { difficulty: 5 })]
  assert.equal(selectTargetedPractice(pool, { count: 1, recentAccuracy: 95 }).questionIds[0], 'hard')
  assert.equal(selectTargetedPractice(pool, { count: 1, recentAccuracy: 20 }).questionIds[0], 'easy')
  // Both bands remain reachable — adaptation ranks, it does not exclude.
  assert.equal(selectTargetedPractice(pool, { count: 2, recentAccuracy: 95 }).questionIds.length, 2)
})

test('too few questions and too little variety are both reported honestly', () => {
  const short = selectTargetedPractice([candidate('a'), candidate('b'), candidate('c'), candidate('d')], {
    count: 10,
    recentAccuracy: null,
  })
  assert.equal(short.questionIds.length, 4)
  assert.equal(short.limited, true)
  assert.match(short.notice!, /4 of the 10/)

  const narrow = selectTargetedPractice(
    [candidate('a', { patternKey: 'p' }), candidate('b', { patternKey: 'p' })],
    { count: 2, recentAccuracy: null }
  )
  assert.equal(narrow.distinctPatterns, 1)
  assert.equal(narrow.limited, true)
  assert.match(narrow.notice!, /similar ground/i)
})
