/**
 * Pure core of the Question-Bank Coverage Dashboard: central configuration,
 * coverage-state policy, per-scope metric aggregation, deterministic
 * reference-export selection, and the current-bank audit.
 *
 * This module is deliberately a LEAF at runtime — every cross-file import is
 * `import type` (erased by the type stripper), so it has no runtime dependency on
 * the taxonomy, DB, or React. That is what lets `node --test` load it directly
 * and keeps the whole coverage policy unit-testable in one place.
 *
 * The taxonomy-aware convenience wrapper `buildCoverage(subjectCodes, …)` lives in
 * `queries.ts` (it needs the real taxonomy at runtime); the pure builder here,
 * `buildSubjectCoverage`, takes an already-resolved SubjectNode.
 */
import type { SubjectNode } from '@/lib/taxonomy'
import type { FullExportQuestion } from '@/lib/questions/export-full-csv'
import type {
  CoverageMetrics,
  CoverageQuestion,
  DomainCoverage,
  SubjectCoverage,
  SubtopicCoverage,
  AuditSubtopicRef,
  CoverageAudit,
} from './types'

// ===========================================================================
// CENTRAL CONFIGURATION — tune coverage policy here, nowhere else.
// ===========================================================================

// -- Difficulty bands --------------------------------------------------------
// questions.difficulty is an integer 1–5 (CHECK constraint). The bank has no
// existing Easy/Medium/Hard mapping, so this is the canonical one.

/** The two canonical subjects this dashboard covers. */
export const COVERAGE_SUBJECT_CODES = ['mathematical_reasoning', 'thinking_skills'] as const

/** A question counts as "recently used in a mock" if used within this window. */
export const RECENT_MOCK_WINDOW_DAYS = 30

export const DIFFICULTY_BANDS = ['easy', 'medium', 'hard'] as const
export type DifficultyBand = (typeof DIFFICULTY_BANDS)[number]

export const DIFFICULTY_BAND_LABELS: Record<DifficultyBand, string> = {
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
}

/** 1–2 → easy, 3 → medium, 4–5 → hard. null / NaN → null. */
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
  return 'hard' // 4, 5 (and any clamped value above)
}

export interface DifficultyBandCounts {
  easy: number
  medium: number
  hard: number
  /** difficulty null / out of range. */
  unknown: number
}

export function emptyDifficultyBandCounts(): DifficultyBandCounts {
  return { easy: 0, medium: 0, hard: 0, unknown: 0 }
}

// -- Difficulty-coverage quality (evaluated over the usable pool) -------------

export const DIFFICULTY_COVERAGE = {
  /** "Reasonable": every band must hold at least this many usable questions. */
  reasonableMinPerBand: 1,
  /** "Healthy": no band may hold fewer than this share of the usable pool. */
  healthyMinBandShare: 0.1,
} as const

// -- Coverage states + thresholds --------------------------------------------

export const COVERAGE_STATES = ['critical', 'limited', 'healthy', 'strong'] as const
export type CoverageState = (typeof COVERAGE_STATES)[number]

/**
 * Thresholds are expressed against the *usable* count (validated AND published
 * AND asset-ready) and the number of distinct pattern keys among that usable
 * pool — so a subtopic padded with many near-identical questions (one pattern)
 * never reads as strong coverage.
 */
export const COVERAGE_THRESHOLDS = {
  // Critical: fewer than 8 usable OR fewer than 3 distinct pattern keys.
  critical: { usableBelow: 8, patternKeysBelow: 3 },
  // Healthy floor: at least 20 usable AND at least 5 distinct pattern keys.
  healthy: { minUsable: 20, minPatternKeys: 5 },
  // Strong: at least 40 usable AND 10 distinct patterns AND a healthy spread.
  strong: { minUsable: 40, minPatternKeys: 10 },
} as const

/** Icon (lucide name) + text label + one-line rule per state. */
export const COVERAGE_STATE_META: Record<
  CoverageState,
  { label: string; icon: string; order: number; description: string }
> = {
  critical: {
    label: 'Critical',
    icon: 'octagon-alert',
    order: 0,
    description: 'Fewer than 8 usable questions or fewer than 3 distinct patterns.',
  },
  limited: {
    label: 'Limited',
    icon: 'triangle-alert',
    order: 1,
    description: '8–19 usable questions, or fewer than 5 distinct patterns.',
  },
  healthy: {
    label: 'Healthy',
    icon: 'circle-check',
    order: 2,
    description: '20+ usable questions, 5+ patterns, and every difficulty covered.',
  },
  strong: {
    label: 'Strong',
    icon: 'shield-check',
    order: 3,
    description: '40+ usable questions, 10+ patterns, and a balanced difficulty spread.',
  },
}

// ===========================================================================
// COVERAGE-STATE POLICY
// ===========================================================================

/** Every difficulty band is represented at least `reasonableMinPerBand` times. */
export function hasReasonableDifficulty(bands: DifficultyBandCounts): boolean {
  const min = DIFFICULTY_COVERAGE.reasonableMinPerBand
  return bands.easy >= min && bands.medium >= min && bands.hard >= min
}

/** Balanced spread: no band below `healthyMinBandShare` of the usable pool. */
export function hasHealthyDifficulty(usableCount: number, bands: DifficultyBandCounts): boolean {
  if (!hasReasonableDifficulty(bands)) {
    return false
  }
  const min = Math.max(1, Math.ceil(usableCount * DIFFICULTY_COVERAGE.healthyMinBandShare))
  return bands.easy >= min && bands.medium >= min && bands.hard >= min
}

/** The single source of truth for a coverage state (inputs from the usable pool). */
export function computeCoverageState(input: {
  usableCount: number
  usablePatternKeys: number
  usableDifficulty: DifficultyBandCounts
}): CoverageState {
  const { usableCount, usablePatternKeys, usableDifficulty } = input

  if (
    usableCount < COVERAGE_THRESHOLDS.critical.usableBelow ||
    usablePatternKeys < COVERAGE_THRESHOLDS.critical.patternKeysBelow
  ) {
    return 'critical'
  }

  if (
    usableCount < COVERAGE_THRESHOLDS.healthy.minUsable ||
    usablePatternKeys < COVERAGE_THRESHOLDS.healthy.minPatternKeys
  ) {
    return 'limited'
  }

  // Healthy requires a reasonable difficulty spread; without it we hold at Limited.
  if (!hasReasonableDifficulty(usableDifficulty)) {
    return 'limited'
  }

  if (
    usableCount >= COVERAGE_THRESHOLDS.strong.minUsable &&
    usablePatternKeys >= COVERAGE_THRESHOLDS.strong.minPatternKeys &&
    hasHealthyDifficulty(usableCount, usableDifficulty)
  ) {
    return 'strong'
  }

  return 'healthy'
}

// ===========================================================================
// METRIC AGGREGATION
// ===========================================================================

const VALIDATED = 'validated'
const PUBLISHED = 'published'

/** A question counts toward the "usable" pool only if all three hold. */
export function isUsable(question: CoverageQuestion): boolean {
  return (
    question.validationStatus === VALIDATED &&
    question.status === PUBLISHED &&
    question.assetReady
  )
}

function tallyDifficulty(target: DifficultyBandCounts, difficulty: number | null): void {
  const band = difficultyBand(difficulty)
  if (band === null) {
    target.unknown += 1
  } else {
    target[band] += 1
  }
}

/**
 * Rolls a list of questions into the full metric bundle. Distinct pattern keys /
 * skills count non-null codes only; the *usable* variants (which drive the
 * coverage state) count from the usable pool alone, so volume built on a single
 * repeated pattern never inflates diversity.
 */
export function summariseQuestions(questions: CoverageQuestion[]): CoverageMetrics {
  const difficulty = emptyDifficultyBandCounts()
  const usableDifficulty = emptyDifficultyBandCounts()

  const skillCodes = new Set<string>()
  const patternKeys = new Set<string>()
  const usablePatternKeys = new Set<string>()
  const questionFamilies = new Set<string>()
  const stimulusFormats = new Set<string>()

  let draft = 0
  let reviewed = 0
  let published = 0
  let archived = 0
  let validatedPublished = 0
  let assetReady = 0
  let usable = 0
  let missingAssets = 0
  let recentlyUsedInMocks = 0

  for (const q of questions) {
    switch (q.status) {
      case 'draft':
        draft += 1
        break
      case 'reviewed':
        reviewed += 1
        break
      case 'published':
        published += 1
        break
      case 'archived':
        archived += 1
        break
    }

    if (q.validationStatus === VALIDATED && q.status === PUBLISHED) {
      validatedPublished += 1
    }
    if (q.assetReady) {
      assetReady += 1
    }
    if (q.hasMissingAsset) {
      missingAssets += 1
    }
    if (q.usedInMockRecently) {
      recentlyUsedInMocks += 1
    }

    tallyDifficulty(difficulty, q.difficulty)

    if (q.skillCode) {
      skillCodes.add(q.skillCode)
    }
    if (q.patternKey) {
      patternKeys.add(q.patternKey)
    }
    if (q.questionFamily) {
      questionFamilies.add(q.questionFamily)
    }
    if (q.stimulusFormat) {
      stimulusFormats.add(q.stimulusFormat)
    }

    if (isUsable(q)) {
      usable += 1
      tallyDifficulty(usableDifficulty, q.difficulty)
      if (q.patternKey) {
        usablePatternKeys.add(q.patternKey)
      }
    }
  }

  return {
    total: questions.length,
    draft,
    reviewed,
    published,
    archived,
    validatedPublished,
    assetReady,
    usable,
    difficulty,
    usableDifficulty,
    distinctSkills: skillCodes.size,
    distinctPatternKeys: patternKeys.size,
    usablePatternKeys: usablePatternKeys.size,
    missingAssets,
    recentlyUsedInMocks,
    skillCodes: [...skillCodes].sort(),
    patternKeys: [...patternKeys].sort(),
    questionFamilies: [...questionFamilies].sort(),
    stimulusFormats: [...stimulusFormats].sort(),
  }
}

/** Derives the coverage state from an already-computed metric bundle. */
export function coverageStateFor(metrics: CoverageMetrics): CoverageState {
  return computeCoverageState({
    usableCount: metrics.usable,
    usablePatternKeys: metrics.usablePatternKeys,
    usableDifficulty: metrics.usableDifficulty,
  })
}

function summariseWithState(questions: CoverageQuestion[]): {
  metrics: CoverageMetrics
  state: CoverageState
} {
  const metrics = summariseQuestions(questions)
  return { metrics, state: coverageStateFor(metrics) }
}

/**
 * Builds the nested coverage tree for a single canonical subject. The taxonomy is
 * the source of truth for which subtopics *should* exist — a subtopic with no
 * matching questions still appears (zero metrics), which is what lets the audit
 * surface missing subtopics.
 */
export function buildSubjectCoverage(
  subject: SubjectNode,
  questions: CoverageQuestion[]
): SubjectCoverage {
  const inSubject = questions.filter((q) => q.subjectCode === subject.code)

  const domains: DomainCoverage[] = subject.domains.map((domainNode) => {
    const inDomain = inSubject.filter((q) => q.domainCode === domainNode.code)

    const subtopics: SubtopicCoverage[] = domainNode.subtopics.map((subtopicNode) => {
      const inSubtopic = inDomain.filter((q) => q.subtopicCode === subtopicNode.code)
      const { metrics, state } = summariseWithState(inSubtopic)
      return { code: subtopicNode.code, label: subtopicNode.label, metrics, state }
    })

    const assignedToSubtopic = new Set(domainNode.subtopics.map((s) => s.code))
    const unassignedToSubtopic = inDomain.filter(
      (q) => !q.subtopicCode || !assignedToSubtopic.has(q.subtopicCode)
    ).length

    const { metrics, state } = summariseWithState(inDomain)
    return {
      code: domainNode.code,
      label: domainNode.label,
      metrics,
      state,
      subtopics,
      unassignedToSubtopic,
    }
  })

  const { metrics, state } = summariseWithState(inSubject)
  return { code: subject.code, label: subject.label, metrics, state, domains }
}

// ===========================================================================
// DETERMINISTIC REFERENCE-EXPORT SELECTION (no AI, no randomness)
// ===========================================================================

export const REFERENCE_EXPORT_STRATEGIES = [
  'all',
  'limit',
  'balanced_difficulty',
  'balanced_pattern',
] as const
export type ReferenceExportStrategy = (typeof REFERENCE_EXPORT_STRATEGIES)[number]

export interface ReferenceExportOptions {
  strategy: ReferenceExportStrategy
  /** Target number of questions for 'limit' / balanced strategies. */
  limit?: number
  /** Applied upstream as a DB filter (status = published). */
  publishedOnly?: boolean
  /** Applied upstream as a DB filter (validation_status = validated). */
  validatedOnly?: boolean
}

const PATTERN_NONE = ' none' // sorts first; groups pattern-less questions together

/** Round-robin across pre-ordered groups, preserving each group's internal order. */
function roundRobin(groups: FullExportQuestion[][], limit: number): FullExportQuestion[] {
  const result: FullExportQuestion[] = []
  const maxLen = groups.reduce((max, g) => Math.max(max, g.length), 0)
  for (let i = 0; i < maxLen && result.length < limit; i += 1) {
    for (const group of groups) {
      if (i < group.length) {
        result.push(group[i])
        if (result.length >= limit) {
          break
        }
      }
    }
  }
  return result
}

function groupByDifficulty(rows: FullExportQuestion[]): FullExportQuestion[][] {
  const buckets = new Map<string, FullExportQuestion[]>()
  for (const band of DIFFICULTY_BANDS) {
    buckets.set(band, [])
  }
  buckets.set('unknown', [])
  for (const row of rows) {
    const key = difficultyBand(row.difficulty) ?? 'unknown'
    buckets.get(key)!.push(row)
  }
  return [...buckets.values()].filter((g) => g.length > 0)
}

function groupByPattern(rows: FullExportQuestion[]): FullExportQuestion[][] {
  const buckets = new Map<string, FullExportQuestion[]>()
  for (const row of rows) {
    const key = row.patternKey ?? PATTERN_NONE
    const bucket = buckets.get(key)
    if (bucket) {
      bucket.push(row)
    } else {
      buckets.set(key, [row])
    }
  }
  return [...buckets.keys()].sort().map((key) => buckets.get(key)!)
}

/**
 * Selects the reference subset. `rows` MUST already be filtered to the coverage
 * row's taxonomy (and any published/validated DB filters) and be in a stable order.
 */
export function selectReferenceQuestions(
  rows: FullExportQuestion[],
  options: ReferenceExportOptions
): FullExportQuestion[] {
  const total = rows.length
  const limit =
    options.limit != null && options.limit > 0 ? Math.min(options.limit, total) : total

  switch (options.strategy) {
    case 'all':
      return [...rows]
    case 'limit':
      return rows.slice(0, limit)
    case 'balanced_difficulty':
      return roundRobin(groupByDifficulty(rows), limit)
    case 'balanced_pattern':
      return roundRobin(groupByPattern(rows), limit)
    default:
      return [...rows]
  }
}

// ===========================================================================
// CURRENT-BANK AUDIT (reports gaps; never mutates content)
// ===========================================================================

function auditRef(
  subject: SubjectCoverage,
  domainLabel: string,
  domainCode: string,
  subtopicCode: string,
  subtopicLabel: string,
  value: number
): AuditSubtopicRef {
  return {
    subjectCode: subject.code,
    subjectLabel: subject.label,
    domainCode,
    domainLabel,
    subtopicCode,
    subtopicLabel,
    value,
  }
}

export function auditCoverage(
  subjects: SubjectCoverage[],
  questions: CoverageQuestion[]
): CoverageAudit {
  const missingSubtopics: AuditSubtopicRef[] = []
  const poorPatternDiversity: AuditSubtopicRef[] = []
  const lackingHardQuestions: AuditSubtopicRef[] = []
  const lackingAssetReady: AuditSubtopicRef[] = []

  const patternFloor = COVERAGE_THRESHOLDS.healthy.minPatternKeys

  for (const subject of subjects) {
    for (const domain of subject.domains) {
      for (const subtopic of domain.subtopics) {
        const m = subtopic.metrics
        if (m.total === 0) {
          missingSubtopics.push(
            auditRef(subject, domain.label, domain.code, subtopic.code, subtopic.label, 0)
          )
          continue
        }
        if (m.distinctPatternKeys < patternFloor) {
          poorPatternDiversity.push(
            auditRef(subject, domain.label, domain.code, subtopic.code, subtopic.label, m.distinctPatternKeys)
          )
        }
        if (m.difficulty.hard === 0) {
          lackingHardQuestions.push(
            auditRef(subject, domain.label, domain.code, subtopic.code, subtopic.label, 0)
          )
        }
        if (m.assetReady === 0) {
          lackingAssetReady.push(
            auditRef(subject, domain.label, domain.code, subtopic.code, subtopic.label, 0)
          )
        }
      }
    }
  }

  let missingCanonicalTaxonomy = 0
  let legacyValuesForReview = 0
  for (const q of questions) {
    if (!q.hasCanonicalTaxonomy) {
      missingCanonicalTaxonomy += 1
    }
    if (q.unresolvedCodes.length > 0) {
      legacyValuesForReview += 1
    }
  }

  return {
    missingSubtopics,
    poorPatternDiversity,
    lackingHardQuestions,
    lackingAssetReady,
    missingCanonicalTaxonomy,
    legacyValuesForReview,
  }
}
