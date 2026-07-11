/**
 * Shared shapes for Subtopic Mastery. Type-only: importing this file never pulls
 * runtime code, which keeps `core.ts` unit-testable in isolation.
 */
import type { MasteryState } from './core'

/**
 * One graded attempt, already snapshotted with canonical taxonomy codes
 * (question_attempts.subtopic_code / skill_code / pattern_key).
 */
export interface MasteryAttempt {
  questionId: string
  isCorrect: boolean
  /** questions.difficulty 1–5; null on legacy rows. */
  difficulty: number | null
  skillCode: string | null
  /** Internal evidence-diversity signal. Never rendered to students. */
  patternKey: string | null
  /** ISO timestamp. */
  attemptedAt: string
}

/** Why a subtopic cannot yet be scored — drives honest student-facing copy. */
export interface MasteryEvidenceGap {
  attemptsNeeded: number
  patternsNeeded: number
}

export interface SubtopicMastery {
  subtopicCode: string
  subtopicLabel: string
  domainCode: string
  domainLabel: string
  subjectCode: string
  state: MasteryState
  /** Weighted performance 0–100; null until any valid attempt exists. */
  masteryPercent: number | null
  /** Every attempt the student made here, including capped repeats. */
  attemptCount: number
  /** Attempts that contributed to the score after anti-inflation caps. */
  validAttemptCount: number
  /** Unweighted accuracy over the newest valid attempts; null below the minimum. */
  recentAccuracy: number | null
  distinctPatterns: number
  distinctSkills: number
  lastPractisedAt: string | null
  /** True when the mastered bar was cleared at some point in the history. */
  everMastered: boolean
  evidenceGap: MasteryEvidenceGap | null
}

export interface DomainMastery {
  domainCode: string
  domainLabel: string
  subjectCode: string
  /** Mean subtopic mastery, counting unattempted subtopics as 0. */
  progressPercent: number
  masteredCount: number
  needsReviewCount: number
  subtopicCount: number
  attemptCount: number
  subtopics: SubtopicMastery[]
}

export interface SubjectMastery {
  subjectCode: string
  subjectLabel: string
  progressPercent: number
  masteredCount: number
  needsReviewCount: number
  subtopicCount: number
  startedSubtopicCount: number
  attemptCount: number
  /** Unweighted accuracy over the subject's newest valid attempts; null when sparse. */
  recentAccuracy: number | null
  domains: DomainMastery[]
}

/** A ranked "practise this next" suggestion. */
export interface MasteryRecommendation {
  subtopicCode: string
  subtopicLabel: string
  domainCode: string
  domainLabel: string
  subjectCode: string
  state: MasteryState
  /** Student-facing sentence explaining why this came up. */
  reason: string
  /** Usable questions available; 0 means it cannot be practised yet. */
  availableQuestions: number
  score: number
}

/** Per-skill roll-up shown inside a subtopic (supporting detail, not navigation). */
export interface SkillBreakdownRow {
  skillCode: string | null
  skillLabel: string
  attempts: number
  correct: number
  accuracy: number
}

export interface DifficultyPerformanceRow {
  band: 'easy' | 'medium' | 'hard'
  attempts: number
  correct: number
  accuracy: number | null
}

/** One point of the accuracy trend (a rolling window over the attempt history). */
export interface AccuracyTrendPoint {
  index: number
  accuracy: number
  attemptedAt: string
}

export interface RecentAttemptRow {
  questionId: string
  questionText: string | null
  isCorrect: boolean
  difficulty: number | null
  skillLabel: string | null
  attemptedAt: string
}

export interface SubtopicMasteryDetail {
  mastery: SubtopicMastery
  skillBreakdown: SkillBreakdownRow[]
  difficultyPerformance: DifficultyPerformanceRow[]
  accuracyTrend: AccuracyTrendPoint[]
  recentAttempts: RecentAttemptRow[]
  /** Usable questions currently available for targeted practice. */
  availableQuestions: number
  distinctAvailablePatterns: number
}

/* -------------------------------------------------------------------------- */
/* Admin analytics                                                             */
/* -------------------------------------------------------------------------- */

export interface SubtopicAnalyticsRow {
  subjectCode: string
  subjectLabel: string
  domainCode: string
  domainLabel: string
  subtopicCode: string
  subtopicLabel: string
  studentsPractising: number
  averageMastery: number | null
  stateCounts: Record<MasteryState, number>
  /** Usable questions in the bank for this subtopic (from the coverage pool). */
  usableQuestions: number
  usablePatternKeys: number
  /** True when the bank cannot support reliable mastery here. */
  insufficientCoverage: boolean
}

export interface SubtopicAnalytics {
  rows: SubtopicAnalyticsRow[]
  weakest: SubtopicAnalyticsRow[]
  insufficientCoverage: SubtopicAnalyticsRow[]
  studentsWithAttempts: number
  attemptsScanned: number
  /** True when the attempt scan hit its cap and figures are a sample. */
  truncated: boolean
  /** Attempts with no canonical subtopic (pre-taxonomy rows). */
  legacyAttempts: number
}
