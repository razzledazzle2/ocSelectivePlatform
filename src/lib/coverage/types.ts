/**
 * Shared types for the Question-Bank Coverage Dashboard. Kept free of DB / React
 * imports so the pure metric + audit code and its tests can use them directly.
 */
import type { CoverageState, DifficultyBandCounts } from './core'

/**
 * The slim per-question record the whole feature reasons over. Built once from a
 * single questions scan (+ asset readiness + recent mock usage) in
 * `src/lib/coverage/queries.ts`, then handed to the pure metric/audit functions.
 * No question text — this stays cheap and crosses the RSC boundary as plain data.
 */
export interface CoverageQuestion {
  id: string
  /** Canonical placement, resolved via the taxonomy (may be null for legacy rows). */
  subjectCode: string | null
  domainCode: string | null
  subtopicCode: string | null
  skillCode: string | null
  patternKey: string | null
  questionFamily: string | null
  stimulusFormat: string | null
  difficulty: number | null
  status: string
  validationStatus: string
  examType: string | null
  yearLevel: number | null
  tags: string[]
  /** No linked asset is pending/rejected (a question with no assets is ready). */
  assetReady: boolean
  /** Has at least one pending/rejected (i.e. missing) linked asset. */
  hasMissingAsset: boolean
  /** Used in a mock exam within the "recent" window. */
  usedInMockRecently: boolean
  /** subtopic_code is set and resolves in the current taxonomy. */
  hasCanonicalTaxonomy: boolean
  /** Non-null codes that no longer resolve in the taxonomy (stale / legacy). */
  unresolvedCodes: string[]
}

/** All the per-subtopic numbers the dashboard shows, plus the derived state inputs. */
export interface CoverageMetrics {
  total: number
  draft: number
  reviewed: number
  published: number
  archived: number
  /** validated AND published (no asset requirement). */
  validatedPublished: number
  /** No pending/rejected assets. */
  assetReady: number
  /** validated AND published AND asset-ready — the "usable" pool. */
  usable: number
  /** Difficulty bands across ALL questions in scope. */
  difficulty: DifficultyBandCounts
  /** Difficulty bands across the usable pool (drives the coverage state). */
  usableDifficulty: DifficultyBandCounts
  distinctSkills: number
  /** Distinct pattern keys across ALL questions in scope. */
  distinctPatternKeys: number
  /** Distinct pattern keys across the usable pool (drives the coverage state). */
  usablePatternKeys: number
  missingAssets: number
  recentlyUsedInMocks: number
  /** Distinct, sorted skill codes present (for the detail view). */
  skillCodes: string[]
  /** Distinct, sorted pattern keys present (for the detail view). */
  patternKeys: string[]
  /** Distinct, sorted question-family codes present. */
  questionFamilies: string[]
  /** Distinct, sorted stimulus-format codes present. */
  stimulusFormats: string[]
}

export interface SubtopicCoverage {
  code: string
  label: string
  metrics: CoverageMetrics
  state: CoverageState
}

export interface DomainCoverage {
  code: string
  label: string
  metrics: CoverageMetrics
  state: CoverageState
  subtopics: SubtopicCoverage[]
  /** Questions placed in the domain but not in any subtopic. */
  unassignedToSubtopic: number
}

export interface SubjectCoverage {
  code: string
  label: string
  metrics: CoverageMetrics
  state: CoverageState
  domains: DomainCoverage[]
}

/** One flagged subtopic in an audit list. */
export interface AuditSubtopicRef {
  subjectCode: string
  subjectLabel: string
  domainCode: string
  domainLabel: string
  subtopicCode: string
  subtopicLabel: string
  /** The metric that triggered the flag (e.g. distinct patterns, hard count). */
  value: number
}

export interface CoverageAudit {
  /** Subtopics defined in the taxonomy with zero questions. */
  missingSubtopics: AuditSubtopicRef[]
  /** Subtopics with questions but fewer than the healthy pattern-key floor. */
  poorPatternDiversity: AuditSubtopicRef[]
  /** Subtopics with questions but no hard (difficulty 4–5) question. */
  lackingHardQuestions: AuditSubtopicRef[]
  /** Subtopics with questions but zero asset-ready questions. */
  lackingAssetReady: AuditSubtopicRef[]
  /** Questions that can't be placed in the canonical taxonomy (no resolved subtopic). */
  missingCanonicalTaxonomy: number
  /** Questions carrying a code value that no longer resolves in the taxonomy. */
  legacyValuesForReview: number
}
