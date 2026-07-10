import type { ExamType } from '@/lib/types'

/**
 * Deterministic, AI-free mock blueprint. A blueprint is a reusable rule set the
 * internal builder selects questions against, and that CSV-imported mocks can be
 * validated against. Every rule is a plain numeric constraint over question
 * metadata — no models, no prompts, no randomness in the rules themselves.
 */

export const BLUEPRINT_STATUSES = ['draft', 'active', 'archived'] as const
export type BlueprintStatus = (typeof BLUEPRINT_STATUSES)[number]

/** The rule kinds a blueprint can express; each maps to one check at evaluation. */
export const BLUEPRINT_RULE_KEYS = [
  'total',
  'required_subtopics',
  'domain_targets',
  'difficulty_targets',
  'pattern_diversity',
  'answer_balance',
] as const
export type BlueprintRuleKey = (typeof BLUEPRINT_RULE_KEYS)[number]

export interface BlueprintDomainTarget {
  domainCode: string
  min?: number
  max?: number
}

export interface BlueprintDifficultyTarget {
  /** 1–5. */
  difficulty: number
  min?: number
  max?: number
}

export interface BlueprintRequiredSubtopic {
  subtopicCode: string
  /** Minimum questions carrying this subtopic (default 1). */
  min?: number
}

export interface BlueprintTotalTarget {
  min?: number
  max?: number
}

export interface MockBlueprintSpec {
  totalQuestions?: BlueprintTotalTarget
  requiredSubtopics?: BlueprintRequiredSubtopic[]
  domainTargets?: BlueprintDomainTarget[]
  difficultyTargets?: BlueprintDifficultyTarget[]
  /** Distinct pattern_key values the mock should contain (variety). */
  minDistinctPatternKeys?: number
  /** Max share (0–1) any single answer letter may hold before it's flagged. */
  maxAnswerShare?: number
  /** Selection hint: avoid questions used within this many days. */
  avoidRecentDays?: number
  /** Rules enforced as HARD (blocking). Everything else is a soft warning. */
  hardRules?: BlueprintRuleKey[]
}

export interface MockBlueprint {
  id: string
  title: string
  description: string | null
  examType: ExamType | null
  subjectCode: string | null
  status: BlueprintStatus
  spec: MockBlueprintSpec
  createdAt: string
  updatedAt: string
}

export interface MockBlueprintListItem {
  id: string
  title: string
  description: string | null
  examType: ExamType | null
  subjectCode: string | null
  status: BlueprintStatus
  /** Target total (max ?? min) for the list summary; null if unset. */
  targetTotal: number | null
  ruleCount: number
  updatedAt: string
}

export interface MockBlueprintInput {
  title: string
  description: string | null
  examType: ExamType | null
  subjectCode: string | null
  status: BlueprintStatus
  spec: MockBlueprintSpec
}

/** Minimal question metadata an evaluation/selection reads. */
export interface BlueprintQuestion {
  difficulty: number
  domainCode: string | null
  subtopicCode: string | null
  patternKey: string | null
  correctOptionLabel: string | null
}

export interface BlueprintCheck {
  key: BlueprintRuleKey
  label: string
  enforcement: 'hard' | 'soft'
  satisfied: boolean
  /** Human-readable actual-vs-expected detail. */
  detail: string
}

export interface BlueprintEvaluation {
  blueprintId: string | null
  blueprintTitle: string | null
  checks: BlueprintCheck[]
  hardViolations: number
  softWarnings: number
  /** True when no HARD rule is violated. */
  satisfied: boolean
}
