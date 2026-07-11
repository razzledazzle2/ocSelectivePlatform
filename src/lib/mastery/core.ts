/**
 * Pure core of Student Subtopic Mastery: central configuration, the mastery
 * formula, state policy, taxonomy roll-up, recommendation ranking and the
 * targeted-practice selector.
 *
 * Like `coverage/core.ts` this module is a runtime LEAF — every cross-file
 * import is `import type` (erased by the type stripper) — so `node --test` can
 * load it directly and the whole mastery policy stays unit-testable in one place.
 *
 * Hierarchy: Subject → Domain → Subtopic, with skills as supporting detail.
 * Students are never scored on stimulus types, question families, asset types,
 * text genres, tags or pattern keys. Pattern keys are used INTERNALLY only, as
 * the evidence-diversity signal, and are never rendered.
 */
import type { DomainNode, SubjectNode, SubtopicNode } from '@/lib/taxonomy'
import type {
  AccuracyTrendPoint,
  DifficultyPerformanceRow,
  DomainMastery,
  MasteryAttempt,
  MasteryRecommendation,
  SubjectMastery,
  SubtopicMastery,
} from './types'

// ===========================================================================
// CENTRAL CONFIGURATION — tune mastery policy here, nowhere else.
// ===========================================================================

/**
 * Subjects with student-facing mastery. Reading is intentionally absent: the
 * pipeline below is subject-generic (add the code here once Reading's bank and
 * comprehension attempts are ready) but this release ships Mathematical
 * Reasoning and Thinking Skills only. Writing is tutor-marked and never included.
 */
export const MASTERY_SUBJECT_CODES = ['mathematical_reasoning', 'thinking_skills'] as const
export type MasterySubjectCode = (typeof MASTERY_SUBJECT_CODES)[number]

export const MASTERY_STATES = [
  'not_started',
  'learning',
  'developing',
  'proficient',
  'mastered',
  'needs_review',
] as const
export type MasteryState = (typeof MASTERY_STATES)[number]

export type MasteryTone = 'default' | 'brand' | 'gold' | 'success' | 'warning'

/** Student-facing label + explanation per state. No internal vocabulary. */
export const MASTERY_STATE_META: Record<
  MasteryState,
  { label: string; description: string; tone: MasteryTone; order: number }
> = {
  not_started: {
    label: 'Not started',
    description: 'You have not answered any questions here yet.',
    tone: 'default',
    order: 0,
  },
  learning: {
    label: 'Learning',
    description: 'Early days — a few more varied questions and we can score this reliably.',
    tone: 'brand',
    order: 1,
  },
  developing: {
    label: 'Developing',
    description: 'You are getting there. Keep practising to lift your accuracy.',
    tone: 'warning',
    order: 2,
  },
  proficient: {
    label: 'Proficient',
    description: 'Solid and consistent. A little more practice to master it.',
    tone: 'gold',
    order: 3,
  },
  mastered: {
    label: 'Mastered',
    description: 'Strong, consistent accuracy across a wide range of questions.',
    tone: 'success',
    order: 4,
  },
  needs_review: {
    label: 'Needs review',
    description: 'You mastered this before, but recent answers have slipped.',
    tone: 'warning',
    order: 5,
  },
}

/**
 * Evidence gates. A subtopic needs BOTH enough valid attempts and enough
 * distinct evidence keys before any performance figure is trusted, so volume
 * built on one repeated template never reads as mastery.
 */
export const MASTERY_GATES = {
  minAttempts: 5,
  minPatterns: 3,
  masteredMinAttempts: 8,
  masteredMinPatterns: 5,
} as const

/** Weighted-performance boundaries, in percent. */
export const MASTERY_THRESHOLDS = {
  /** Below this (with gates met) → developing. */
  proficient: 65,
  /** At or above this (plus evidence + recent gates) → mastered. */
  mastered: 85,
  /** `mastered` also requires recent accuracy at or above this. */
  masteredMinRecent: 80,
  /** A previously mastered subtopic drops to `needs_review` below this. */
  needsReviewRecent: 70,
} as const

/** How many of the newest valid attempts define "recent performance". */
export const RECENT_WINDOW = 10

/** Recent accuracy is only trusted once this many valid attempts exist. */
export const RECENT_MIN_ATTEMPTS = 3

/**
 * Anti-inflation caps, applied newest-first when choosing which attempts feed
 * the score. Re-drilling one question, or grinding one pattern, cannot inflate
 * mastery — yet every raw attempt is still stored and still shown in history.
 */
export const EVIDENCE_CAPS = {
  perQuestion: 2,
  perPattern: 6,
} as const

export const DIFFICULTY_WEIGHTS = {
  easy: 0.85,
  medium: 1.0,
  hard: 1.15,
  /** difficulty is nullable on legacy attempts — treat as medium, never drop the row. */
  unknown: 1.0,
} as const

/**
 * Recency bands over an attempt's newest-first rank (1-based), in ascending
 * `throughRank` order. The final band is the tail.
 */
export const RECENCY_WEIGHT_BANDS: ReadonlyArray<{ throughRank: number; weight: number }> = [
  { throughRank: 5, weight: 1.0 },
  { throughRank: 10, weight: 0.8 },
  { throughRank: 20, weight: 0.55 },
  { throughRank: Number.POSITIVE_INFINITY, weight: 0.3 },
]

export const RECOMMENDATION = {
  limit: 3,
  /** A subtopic practised within this window is held back from recommendations. */
  cooldownHours: 12,
  /** A mastered subtopic becomes due for a refresher after this long. */
  masteredRefreshDays: 30,
  statePriority: {
    needs_review: 100,
    developing: 80,
    learning: 60,
    mastered: 40,
    not_started: 30,
    proficient: 20,
  } as Record<MasteryState, number>,
} as const

export const TARGETED_PRACTICE = {
  /** Questions inside the student's newest N attempts are avoided as immediate repeats. */
  avoidRecentAttempts: 20,
  /** Fewer distinct evidence keys than this in the built set is reported honestly. */
  minDistinctPatterns: 3,
  /** Modest difficulty adaptation from recent performance. */
  adaptation: {
    stretchAbove: 80,
    supportBelow: 55,
  },
} as const

// ===========================================================================
// WEIGHTING
// ===========================================================================

export type DifficultyBand = 'easy' | 'medium' | 'hard'

/** 1–2 → easy, 3 → medium, 4–5 → hard. Mirrors the coverage dashboard's bands. */
export function difficultyBand(difficulty: number | null | undefined): DifficultyBand | null {
  if (difficulty == null || Number.isNaN(difficulty)) {
    return null
  }
  if (difficulty <= 2) {
    return 'easy'
  }
  if (difficulty === 3) {
    return 'medium'
  }
  return 'hard'
}

/** Legacy attempts with no/odd difficulty weight as medium rather than being dropped. */
export function difficultyWeight(difficulty: number | null | undefined): number {
  const band = difficultyBand(difficulty)
  return band === null ? DIFFICULTY_WEIGHTS.unknown : DIFFICULTY_WEIGHTS[band]
}

/** `rank` is 1-based, newest first. */
export function recencyWeight(rank: number): number {
  for (const band of RECENCY_WEIGHT_BANDS) {
    if (rank <= band.throughRank) {
      return band.weight
    }
  }
  return RECENCY_WEIGHT_BANDS[RECENCY_WEIGHT_BANDS.length - 1].weight
}

/**
 * The internal diversity key for one attempt. Falls back to the question id when
 * the bank has no pattern key, so an unlabelled bank degrades to "distinct
 * questions" rather than stalling every student at `learning` forever.
 */
export function evidenceKey(attempt: Pick<MasteryAttempt, 'questionId' | 'patternKey'>): string {
  return attempt.patternKey ? `pattern:${attempt.patternKey}` : `question:${attempt.questionId}`
}

// ===========================================================================
// VALID-ATTEMPT SELECTION (anti-inflation)
// ===========================================================================

/** Newest first. Ties broken by question id so the order is deterministic. */
export function sortNewestFirst(attempts: MasteryAttempt[]): MasteryAttempt[] {
  return [...attempts].sort((a, b) => {
    const delta = Date.parse(b.attemptedAt) - Date.parse(a.attemptedAt)
    return delta !== 0 ? delta : a.questionId.localeCompare(b.questionId)
  })
}

/**
 * Keeps, newest-first, at most `perQuestion` attempts of any one question and
 * `perPattern` attempts of any one evidence key. Nothing is deleted — the raw
 * list is untouched; this only decides what *counts* toward the score.
 */
export function selectValidAttempts(attempts: MasteryAttempt[]): MasteryAttempt[] {
  const byQuestion = new Map<string, number>()
  const byPattern = new Map<string, number>()
  const kept: MasteryAttempt[] = []

  for (const attempt of sortNewestFirst(attempts)) {
    const key = evidenceKey(attempt)
    const questionCount = byQuestion.get(attempt.questionId) ?? 0
    const patternCount = byPattern.get(key) ?? 0

    if (questionCount >= EVIDENCE_CAPS.perQuestion || patternCount >= EVIDENCE_CAPS.perPattern) {
      continue
    }

    byQuestion.set(attempt.questionId, questionCount + 1)
    byPattern.set(key, patternCount + 1)
    kept.push(attempt)
  }

  return kept
}

/** Weighted performance (0–100) over already-selected, newest-first attempts. */
export function weightedPerformance(validAttempts: MasteryAttempt[]): number | null {
  if (validAttempts.length === 0) {
    return null
  }

  let weightedCorrect = 0
  let totalWeight = 0

  validAttempts.forEach((attempt, index) => {
    const weight = difficultyWeight(attempt.difficulty) * recencyWeight(index + 1)
    totalWeight += weight
    if (attempt.isCorrect) {
      weightedCorrect += weight
    }
  })

  return totalWeight === 0 ? null : (weightedCorrect / totalWeight) * 100
}

/** Unweighted accuracy over the newest `RECENT_WINDOW` valid attempts. */
export function recentAccuracy(validAttempts: MasteryAttempt[]): number | null {
  const window = validAttempts.slice(0, RECENT_WINDOW)
  if (window.length < RECENT_MIN_ATTEMPTS) {
    return null
  }
  const correct = window.filter((attempt) => attempt.isCorrect).length
  return (correct / window.length) * 100
}

function distinctCount<T>(values: Array<T | null>): number {
  const set = new Set<T>()
  for (const value of values) {
    if (value !== null && value !== undefined) {
      set.add(value)
    }
  }
  return set.size
}

// ===========================================================================
// STATE POLICY
// ===========================================================================

export interface MasteryEvidence {
  validAttempts: number
  distinctPatterns: number
  weighted: number | null
  recent: number | null
}

/** True when the evidence and performance clear the `mastered` bar. */
export function meetsMasteredBar(evidence: MasteryEvidence): boolean {
  return (
    evidence.weighted !== null &&
    evidence.weighted >= MASTERY_THRESHOLDS.mastered &&
    evidence.validAttempts >= MASTERY_GATES.masteredMinAttempts &&
    evidence.distinctPatterns >= MASTERY_GATES.masteredMinPatterns &&
    evidence.recent !== null &&
    evidence.recent >= MASTERY_THRESHOLDS.masteredMinRecent
  )
}

/**
 * The single source of truth for a mastery state.
 *
 * not_started → no valid attempts
 * learning    → below the attempt or pattern gate
 * needs_review→ previously mastered, recent performance has materially fallen
 * mastered    → high weighted performance on wide, recent evidence
 * proficient  → gates met, weighted performance 65–84
 * developing  → gates met, weighted performance below 65
 */
export function computeMasteryState(evidence: MasteryEvidence, everMastered: boolean): MasteryState {
  if (evidence.validAttempts === 0 || evidence.weighted === null) {
    return 'not_started'
  }

  if (
    evidence.validAttempts < MASTERY_GATES.minAttempts ||
    evidence.distinctPatterns < MASTERY_GATES.minPatterns
  ) {
    return 'learning'
  }

  if (
    everMastered &&
    evidence.recent !== null &&
    evidence.recent < MASTERY_THRESHOLDS.needsReviewRecent
  ) {
    return 'needs_review'
  }

  if (meetsMasteredBar(evidence)) {
    return 'mastered'
  }

  if (evidence.weighted >= MASTERY_THRESHOLDS.proficient) {
    return 'proficient'
  }

  return 'developing'
}

/** Evidence measured over an already newest-first, capped attempt list. */
function evidenceFor(validAttempts: MasteryAttempt[]): MasteryEvidence {
  return {
    validAttempts: validAttempts.length,
    distinctPatterns: new Set(validAttempts.map(evidenceKey)).size,
    weighted: weightedPerformance(validAttempts),
    recent: recentAccuracy(validAttempts),
  }
}

/** Above this many attempts the prefix walk strides, to stay linear-ish. */
const EVER_MASTERED_SCAN_CAP = 100

/**
 * Did the student ever clear the mastered bar? Derived from the raw history —
 * replaying the evidence exactly as it stood after each earlier attempt —
 * rather than stored, so it can never drift from the attempts it summarises.
 */
export function everReachedMastered(attempts: MasteryAttempt[]): boolean {
  const oldestFirst = [...sortNewestFirst(attempts)].reverse()
  const total = oldestFirst.length
  if (total < MASTERY_GATES.masteredMinAttempts) {
    return false
  }

  const step = Math.max(1, Math.ceil(total / EVER_MASTERED_SCAN_CAP))
  for (let size = MASTERY_GATES.masteredMinAttempts; size <= total; size += step) {
    // Re-derive the capped evidence as it stood at that moment in time.
    const asOf = selectValidAttempts(oldestFirst.slice(0, size))
    if (meetsMasteredBar(evidenceFor(asOf))) {
      return true
    }
  }
  // Always evaluate the present moment, even when the stride skipped it.
  return meetsMasteredBar(evidenceFor(selectValidAttempts(oldestFirst)))
}

// ===========================================================================
// SUBTOPIC / DOMAIN / SUBJECT
// ===========================================================================

/** The evidence still missing before a subtopic can be scored, or null. */
function evidenceGapFor(evidence: MasteryEvidence): SubtopicMastery['evidenceGap'] {
  const attemptsNeeded = Math.max(0, MASTERY_GATES.minAttempts - evidence.validAttempts)
  const patternsNeeded = Math.max(0, MASTERY_GATES.minPatterns - evidence.distinctPatterns)
  return attemptsNeeded === 0 && patternsNeeded === 0 ? null : { attemptsNeeded, patternsNeeded }
}

export function computeSubtopicMastery(
  subtopic: Pick<SubtopicNode, 'code' | 'label' | 'domainCode' | 'subjectCode'>,
  attempts: MasteryAttempt[],
  domainLabel = ''
): SubtopicMastery {
  const ordered = sortNewestFirst(attempts)
  const valid = selectValidAttempts(ordered)
  const evidence = evidenceFor(valid)
  const everMastered = everReachedMastered(ordered)
  const state = computeMasteryState(evidence, everMastered)

  return {
    subtopicCode: subtopic.code,
    subtopicLabel: subtopic.label,
    domainCode: subtopic.domainCode,
    domainLabel,
    subjectCode: subtopic.subjectCode,
    state,
    masteryPercent: evidence.weighted === null ? null : Math.round(evidence.weighted),
    attemptCount: ordered.length,
    validAttemptCount: evidence.validAttempts,
    recentAccuracy: evidence.recent === null ? null : Math.round(evidence.recent),
    distinctPatterns: evidence.distinctPatterns,
    distinctSkills: distinctCount(valid.map((attempt) => attempt.skillCode)),
    lastPractisedAt: ordered[0]?.attemptedAt ?? null,
    everMastered,
    evidenceGap: state === 'not_started' ? null : evidenceGapFor(evidence),
  }
}

/**
 * Progress across a set of subtopics: the mean mastery percentage, counting a
 * subtopic with no attempts as 0. This is deliberately coverage-weighted —
 * practising three subtopics perfectly is not "100% of the domain".
 */
export function progressPercent(subtopics: SubtopicMastery[]): number {
  if (subtopics.length === 0) {
    return 0
  }
  const total = subtopics.reduce((sum, subtopic) => sum + (subtopic.masteryPercent ?? 0), 0)
  return Math.round(total / subtopics.length)
}

export function buildDomainMastery(
  domain: Pick<DomainNode, 'code' | 'label' | 'subjectCode'>,
  subtopics: SubtopicMastery[]
): DomainMastery {
  return {
    domainCode: domain.code,
    domainLabel: domain.label,
    subjectCode: domain.subjectCode,
    progressPercent: progressPercent(subtopics),
    masteredCount: subtopics.filter((s) => s.state === 'mastered').length,
    needsReviewCount: subtopics.filter((s) => s.state === 'needs_review').length,
    subtopicCount: subtopics.length,
    attemptCount: subtopics.reduce((sum, s) => sum + s.attemptCount, 0),
    subtopics,
  }
}

/**
 * Builds the whole Subject → Domain → Subtopic mastery tree. The taxonomy is the
 * source of truth for which subtopics exist, so an unattempted subtopic still
 * appears (as `not_started`) rather than vanishing.
 */
export function buildSubjectMastery(
  subject: SubjectNode,
  attemptsBySubtopic: Map<string, MasteryAttempt[]>
): SubjectMastery {
  const domains = subject.domains.map((domainNode) =>
    buildDomainMastery(
      domainNode,
      domainNode.subtopics.map((subtopicNode) =>
        computeSubtopicMastery(
          subtopicNode,
          attemptsBySubtopic.get(subtopicNode.code) ?? [],
          domainNode.label
        )
      )
    )
  )

  const allSubtopics = domains.flatMap((domain) => domain.subtopics)
  const subjectAttempts = sortNewestFirst(
    allSubtopics.flatMap((subtopic) => attemptsBySubtopic.get(subtopic.subtopicCode) ?? [])
  )

  return {
    subjectCode: subject.code,
    subjectLabel: subject.label,
    progressPercent: progressPercent(allSubtopics),
    masteredCount: allSubtopics.filter((s) => s.state === 'mastered').length,
    needsReviewCount: allSubtopics.filter((s) => s.state === 'needs_review').length,
    subtopicCount: allSubtopics.length,
    startedSubtopicCount: allSubtopics.filter((s) => s.state !== 'not_started').length,
    attemptCount: subjectAttempts.length,
    recentAccuracy: recentAccuracy(selectValidAttempts(subjectAttempts)),
    domains,
  }
}

// ===========================================================================
// DIFFICULTY / SKILL / TREND BREAKDOWNS (subtopic detail)
// ===========================================================================

export function difficultyPerformance(attempts: MasteryAttempt[]): DifficultyPerformanceRow[] {
  const bands: DifficultyBand[] = ['easy', 'medium', 'hard']
  return bands.map((band) => {
    const inBand = attempts.filter((attempt) => difficultyBand(attempt.difficulty) === band)
    const correct = inBand.filter((attempt) => attempt.isCorrect).length
    return {
      band,
      attempts: inBand.length,
      correct,
      accuracy: inBand.length === 0 ? null : Math.round((correct / inBand.length) * 100),
    }
  })
}

/**
 * A rolling accuracy trend over the attempt history, oldest → newest. The window
 * grows to `size` then slides, so an early streak cannot dominate the whole line.
 */
export function accuracyTrend(attempts: MasteryAttempt[], size = 5): AccuracyTrendPoint[] {
  const oldestFirst = [...sortNewestFirst(attempts)].reverse()
  return oldestFirst.map((attempt, index) => {
    const window = oldestFirst.slice(Math.max(0, index - size + 1), index + 1)
    const correct = window.filter((item) => item.isCorrect).length
    return {
      index: index + 1,
      accuracy: Math.round((correct / window.length) * 100),
      attemptedAt: attempt.attemptedAt,
    }
  })
}

// ===========================================================================
// RECOMMENDATIONS
// ===========================================================================

export interface RecommendationInput {
  mastery: SubtopicMastery
  /** Usable questions available for targeted practice right now. */
  availableQuestions: number
  /** Taxonomy order — earlier subtopics are more foundational, so more important. */
  importance: number
}

const HOUR_MS = 60 * 60 * 1000

function hoursSince(iso: string | null, now: number): number {
  return iso === null ? Number.POSITIVE_INFINITY : (now - Date.parse(iso)) / HOUR_MS
}

function reasonFor(input: RecommendationInput, now: number): string {
  const { mastery } = input
  switch (mastery.state) {
    case 'needs_review':
      return 'You mastered this before and recent answers have slipped — worth a refresher.'
    case 'developing':
      return mastery.recentAccuracy !== null
        ? `Your recent accuracy here is ${mastery.recentAccuracy}%. A focused set will lift it.`
        : 'Accuracy here is below where it needs to be.'
    case 'learning':
      return 'A few more varied questions and we can score this properly.'
    case 'mastered':
      return hoursSince(mastery.lastPractisedAt, now) > RECOMMENDATION.masteredRefreshDays * 24
        ? 'Mastered a while ago — a short refresher keeps it sharp.'
        : 'Keep this one warm.'
    case 'not_started':
      return 'You have not practised this yet.'
    case 'proficient':
      return 'Close to mastered — a little more practice would get you there.'
  }
}

/**
 * Ranks what to practise next. Priority order follows the product rule:
 * needs review → weak recent performance → developing → important unattempted →
 * previously mastered and due for a refresher.
 *
 * A subtopic practised inside the cooldown window is held back, so finishing a
 * set never immediately re-recommends the same practice. If everything is
 * cooling down, the cooled list is used rather than showing nothing.
 */
export function rankRecommendations(
  inputs: RecommendationInput[],
  options: { now?: number; limit?: number } = {}
): MasteryRecommendation[] {
  const now = options.now ?? Date.now()
  const limit = options.limit ?? RECOMMENDATION.limit

  const practisable = inputs.filter((input) => input.availableQuestions > 0)

  const score = (input: RecommendationInput): number => {
    const { mastery } = input
    let value = RECOMMENDATION.statePriority[mastery.state]

    // Weak recent performance outranks everything else inside a state.
    if (mastery.recentAccuracy !== null) {
      value += Math.max(0, MASTERY_THRESHOLDS.proficient - mastery.recentAccuracy) / 2
    }

    if (mastery.state === 'mastered') {
      const stale = hoursSince(mastery.lastPractisedAt, now) > RECOMMENDATION.masteredRefreshDays * 24
      value += stale ? 20 : -35
    }

    if (mastery.state === 'not_started') {
      // Earlier (more foundational) subtopics first.
      value += Math.max(0, 20 - input.importance)
    }

    return value
  }

  const rank = (pool: RecommendationInput[]): MasteryRecommendation[] =>
    [...pool]
      .sort((a, b) => {
        const delta = score(b) - score(a)
        if (delta !== 0) return delta
        const importance = a.importance - b.importance
        return importance !== 0 ? importance : a.mastery.subtopicCode.localeCompare(b.mastery.subtopicCode)
      })
      .slice(0, limit)
      .map((input) => ({
        subtopicCode: input.mastery.subtopicCode,
        subtopicLabel: input.mastery.subtopicLabel,
        domainCode: input.mastery.domainCode,
        domainLabel: input.mastery.domainLabel,
        subjectCode: input.mastery.subjectCode,
        state: input.mastery.state,
        reason: reasonFor(input, now),
        availableQuestions: input.availableQuestions,
        score: Math.round(score(input)),
      }))

  const warm = practisable.filter(
    (input) => hoursSince(input.mastery.lastPractisedAt, now) >= RECOMMENDATION.cooldownHours
  )

  return rank(warm.length > 0 ? warm : practisable)
}

// ===========================================================================
// TARGETED PRACTICE SELECTION
// ===========================================================================

export interface PracticeCandidate {
  id: string
  difficulty: number | null
  skillCode: string | null
  patternKey: string | null
  /** 1-based position in the student's newest-first attempt history; null = never seen. */
  recentAttemptRank: number | null
}

export interface TargetedSelection {
  questionIds: string[]
  distinctPatterns: number
  distinctSkills: number
  requested: number
  /** True when the set is smaller or less varied than asked for. */
  limited: boolean
  /** Honest, student-facing explanation when `limited`; null otherwise. */
  notice: string | null
  /** The difficulty the set aimed at, from recent performance. */
  targetBand: DifficultyBand
}

/** Modest adaptation: aim harder when recent work is strong, easier when it is not. */
export function targetDifficultyBand(recent: number | null): DifficultyBand {
  if (recent === null) {
    return 'medium'
  }
  if (recent >= TARGETED_PRACTICE.adaptation.stretchAbove) {
    return 'hard'
  }
  if (recent < TARGETED_PRACTICE.adaptation.supportBelow) {
    return 'easy'
  }
  return 'medium'
}

const BAND_INDEX: Record<DifficultyBand, number> = { easy: 0, medium: 1, hard: 2 }

function bandDistance(difficulty: number | null, target: DifficultyBand): number {
  const band = difficultyBand(difficulty)
  return band === null ? 1 : Math.abs(BAND_INDEX[band] - BAND_INDEX[target])
}

/**
 * Builds a varied, non-repeating practice set from an already-filtered candidate
 * pool (published · valid answer · asset-ready · this subtopic).
 *
 * Selection is a deterministic greedy pass that, at every step, prefers a
 * question whose evidence key (pattern) is unused, then whose skill is unused,
 * then whose difficulty is closest to the adaptive target. Callers shuffle the
 * pool beforehand, so equally-good candidates still vary between sessions.
 *
 * Questions inside the student's newest `avoidRecentAttempts` attempts are held
 * back; they are only used to top up a set that would otherwise be too short,
 * oldest-seen first.
 */
export function selectTargetedPractice(
  candidates: PracticeCandidate[],
  options: { count: number; recentAccuracy: number | null; avoidRecentAttempts?: number }
): TargetedSelection {
  const target = targetDifficultyBand(options.recentAccuracy)
  const avoidWithin = options.avoidRecentAttempts ?? TARGETED_PRACTICE.avoidRecentAttempts

  const isImmediateRepeat = (candidate: PracticeCandidate): boolean =>
    candidate.recentAttemptRank !== null && candidate.recentAttemptRank <= avoidWithin

  const preferred = candidates.filter((candidate) => !isImmediateRepeat(candidate))
  // Oldest-seen first, so a top-up reaches for the least-recent repeat.
  const fallback = candidates
    .filter(isImmediateRepeat)
    .sort((a, b) => (b.recentAttemptRank ?? 0) - (a.recentAttemptRank ?? 0))

  const pool = [...preferred, ...fallback]

  const usedPatterns = new Set<string>()
  const usedSkills = new Set<string>()
  const picked: PracticeCandidate[] = []
  const remaining = new Set(pool.map((candidate) => candidate.id))
  const byId = new Map(pool.map((candidate) => [candidate.id, candidate]))

  const cost = (candidate: PracticeCandidate): number => {
    const key = evidenceKey({ questionId: candidate.id, patternKey: candidate.patternKey })
    const patternCost = usedPatterns.has(key) ? 4 : 0
    const skillCost = candidate.skillCode && usedSkills.has(candidate.skillCode) ? 2 : 0
    const repeatCost = isImmediateRepeat(candidate) ? 8 : 0
    return repeatCost + patternCost + skillCost + bandDistance(candidate.difficulty, target)
  }

  while (picked.length < options.count && remaining.size > 0) {
    let best: PracticeCandidate | null = null
    let bestCost = Number.POSITIVE_INFINITY

    for (const id of remaining) {
      const candidate = byId.get(id)!
      const candidateCost = cost(candidate)
      if (candidateCost < bestCost) {
        best = candidate
        bestCost = candidateCost
      }
    }

    if (!best) {
      break
    }

    remaining.delete(best.id)
    picked.push(best)
    usedPatterns.add(evidenceKey({ questionId: best.id, patternKey: best.patternKey }))
    if (best.skillCode) {
      usedSkills.add(best.skillCode)
    }
  }

  const distinctPatterns = new Set(
    picked.map((candidate) => evidenceKey({ questionId: candidate.id, patternKey: candidate.patternKey }))
  ).size
  const distinctSkills = distinctCount(picked.map((candidate) => candidate.skillCode))

  const short = picked.length < options.count
  const narrow =
    picked.length > 0 && distinctPatterns < Math.min(TARGETED_PRACTICE.minDistinctPatterns, picked.length)

  let notice: string | null = null
  if (picked.length === 0) {
    notice = 'There are no practice-ready questions in this subtopic yet.'
  } else if (short && narrow) {
    notice = `Only ${picked.length} varied question${picked.length === 1 ? '' : 's'} are ready here, and they cover similar ground. Your score will stay provisional until more are added.`
  } else if (short) {
    notice = `Only ${picked.length} of the ${options.count} questions you asked for are ready in this subtopic.`
  } else if (narrow) {
    notice = 'These questions cover similar ground, so this set will not prove mastery on its own.'
  }

  return {
    questionIds: picked.map((candidate) => candidate.id),
    distinctPatterns,
    distinctSkills,
    requested: options.count,
    limited: short || narrow || picked.length === 0,
    notice,
    targetBand: target,
  }
}
