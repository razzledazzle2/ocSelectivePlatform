import { BLUEPRINT_RULE_KEYS } from '@/lib/mock-blueprints/types'
import type {
  BlueprintDifficultyTarget,
  BlueprintDomainTarget,
  BlueprintRequiredSubtopic,
  BlueprintRuleKey,
  MockBlueprintSpec,
} from '@/lib/mock-blueprints/types'

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function asNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

/**
 * Coerce arbitrary jsonb (from DB or a form) into a well-formed MockBlueprintSpec,
 * dropping anything malformed. Never throws — an unknown blob becomes an empty spec.
 */
export function normalizeBlueprintSpec(raw: unknown): MockBlueprintSpec {
  const record = asRecord(raw)
  if (!record) return {}
  const spec: MockBlueprintSpec = {}

  const total = asRecord(record.totalQuestions)
  if (total) {
    const min = asNumber(total.min)
    const max = asNumber(total.max)
    if (min != null || max != null) spec.totalQuestions = { ...(min != null && { min }), ...(max != null && { max }) }
  }

  const requiredSubtopics = asArray(record.requiredSubtopics)
    .map((entry): BlueprintRequiredSubtopic | null => {
      const item = asRecord(entry)
      const subtopicCode = asString(item?.subtopicCode)
      if (!subtopicCode) return null
      const min = asNumber(item?.min)
      return { subtopicCode, ...(min != null && { min }) }
    })
    .filter((entry): entry is BlueprintRequiredSubtopic => entry !== null)
  if (requiredSubtopics.length > 0) spec.requiredSubtopics = requiredSubtopics

  const domainTargets = asArray(record.domainTargets)
    .map((entry): BlueprintDomainTarget | null => {
      const item = asRecord(entry)
      const domainCode = asString(item?.domainCode)
      if (!domainCode) return null
      const min = asNumber(item?.min)
      const max = asNumber(item?.max)
      return { domainCode, ...(min != null && { min }), ...(max != null && { max }) }
    })
    .filter((entry): entry is BlueprintDomainTarget => entry !== null)
  if (domainTargets.length > 0) spec.domainTargets = domainTargets

  const difficultyTargets = asArray(record.difficultyTargets)
    .map((entry): BlueprintDifficultyTarget | null => {
      const item = asRecord(entry)
      const difficulty = asNumber(item?.difficulty)
      if (difficulty == null || difficulty < 1 || difficulty > 5) return null
      const min = asNumber(item?.min)
      const max = asNumber(item?.max)
      return { difficulty, ...(min != null && { min }), ...(max != null && { max }) }
    })
    .filter((entry): entry is BlueprintDifficultyTarget => entry !== null)
  if (difficultyTargets.length > 0) spec.difficultyTargets = difficultyTargets

  const minDistinctPatternKeys = asNumber(record.minDistinctPatternKeys)
  if (minDistinctPatternKeys != null && minDistinctPatternKeys > 0) {
    spec.minDistinctPatternKeys = Math.floor(minDistinctPatternKeys)
  }

  const maxAnswerShare = asNumber(record.maxAnswerShare)
  if (maxAnswerShare != null && maxAnswerShare > 0 && maxAnswerShare <= 1) {
    spec.maxAnswerShare = maxAnswerShare
  }

  const avoidRecentDays = asNumber(record.avoidRecentDays)
  if (avoidRecentDays != null && avoidRecentDays > 0) {
    spec.avoidRecentDays = Math.floor(avoidRecentDays)
  }

  const hardRules = asArray(record.hardRules)
    .map((value) => asString(value))
    .filter((value): value is BlueprintRuleKey => (BLUEPRINT_RULE_KEYS as readonly string[]).includes(value))
  if (hardRules.length > 0) spec.hardRules = [...new Set(hardRules)]

  return spec
}

/** Count the configured rules in a spec (for list summaries). */
export function countBlueprintRules(spec: MockBlueprintSpec): number {
  let count = 0
  if (spec.totalQuestions && (spec.totalQuestions.min != null || spec.totalQuestions.max != null)) count += 1
  if (spec.requiredSubtopics?.length) count += 1
  if (spec.domainTargets?.length) count += 1
  if (spec.difficultyTargets?.length) count += 1
  if (spec.minDistinctPatternKeys != null) count += 1
  if (spec.maxAnswerShare != null) count += 1
  return count
}

/** Target total (max preferred over min) for list summaries; null when unset. */
export function blueprintTargetTotal(spec: MockBlueprintSpec): number | null {
  return spec.totalQuestions?.max ?? spec.totalQuestions?.min ?? null
}
