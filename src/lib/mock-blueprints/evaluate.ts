import type {
  BlueprintCheck,
  BlueprintEvaluation,
  BlueprintQuestion,
  BlueprintRuleKey,
  MockBlueprintSpec,
} from '@/lib/mock-blueprints/types'

function enforcementFor(spec: MockBlueprintSpec, key: BlueprintRuleKey): 'hard' | 'soft' {
  return spec.hardRules?.includes(key) ? 'hard' : 'soft'
}

/**
 * Evaluate a set of questions against a blueprint spec — pure, deterministic,
 * no I/O. Each configured rule produces exactly one check; a rule that is not
 * configured produces no check. Hard-rule violations set `satisfied = false`
 * (used to block publishing); soft violations are warnings only.
 */
export function evaluateBlueprint(
  questions: BlueprintQuestion[],
  spec: MockBlueprintSpec,
  meta: { blueprintId?: string | null; blueprintTitle?: string | null } = {}
): BlueprintEvaluation {
  const checks: BlueprintCheck[] = []
  const total = questions.length

  // -- Total questions --------------------------------------------------------
  if (spec.totalQuestions && (spec.totalQuestions.min != null || spec.totalQuestions.max != null)) {
    const { min, max } = spec.totalQuestions
    const okMin = min == null || total >= min
    const okMax = max == null || total <= max
    checks.push({
      key: 'total',
      label: 'Total questions',
      enforcement: enforcementFor(spec, 'total'),
      satisfied: okMin && okMax,
      detail: `${total} question${total === 1 ? '' : 's'} (target ${formatRange(min, max)}).`,
    })
  }

  // -- Required subtopics -----------------------------------------------------
  if (spec.requiredSubtopics && spec.requiredSubtopics.length > 0) {
    const counts = countBy(questions, (q) => q.subtopicCode)
    const missing = spec.requiredSubtopics.filter((req) => {
      const need = req.min ?? 1
      return (counts.get(req.subtopicCode) ?? 0) < need
    })
    checks.push({
      key: 'required_subtopics',
      label: 'Required subtopics',
      enforcement: enforcementFor(spec, 'required_subtopics'),
      satisfied: missing.length === 0,
      detail:
        missing.length === 0
          ? `All ${spec.requiredSubtopics.length} required subtopic${
              spec.requiredSubtopics.length === 1 ? '' : 's'
            } present.`
          : `Missing: ${missing
              .map((req) => `${req.subtopicCode} (need ${req.min ?? 1}, have ${counts.get(req.subtopicCode) ?? 0})`)
              .join('; ')}.`,
    })
  }

  // -- Domain targets ---------------------------------------------------------
  if (spec.domainTargets && spec.domainTargets.length > 0) {
    const counts = countBy(questions, (q) => q.domainCode)
    const breaches = spec.domainTargets.filter((target) => {
      const have = counts.get(target.domainCode) ?? 0
      const okMin = target.min == null || have >= target.min
      const okMax = target.max == null || have <= target.max
      return !(okMin && okMax)
    })
    checks.push({
      key: 'domain_targets',
      label: 'Domain distribution',
      enforcement: enforcementFor(spec, 'domain_targets'),
      satisfied: breaches.length === 0,
      detail:
        breaches.length === 0
          ? `All ${spec.domainTargets.length} domain target${spec.domainTargets.length === 1 ? '' : 's'} met.`
          : breaches
              .map(
                (target) =>
                  `${target.domainCode}: ${counts.get(target.domainCode) ?? 0} (target ${formatRange(
                    target.min,
                    target.max
                  )})`
              )
              .join('; ') + '.',
    })
  }

  // -- Difficulty targets -----------------------------------------------------
  if (spec.difficultyTargets && spec.difficultyTargets.length > 0) {
    const counts = countBy(questions, (q) => String(q.difficulty))
    const breaches = spec.difficultyTargets.filter((target) => {
      const have = counts.get(String(target.difficulty)) ?? 0
      const okMin = target.min == null || have >= target.min
      const okMax = target.max == null || have <= target.max
      return !(okMin && okMax)
    })
    checks.push({
      key: 'difficulty_targets',
      label: 'Difficulty distribution',
      enforcement: enforcementFor(spec, 'difficulty_targets'),
      satisfied: breaches.length === 0,
      detail:
        breaches.length === 0
          ? `All ${spec.difficultyTargets.length} difficulty target${
              spec.difficultyTargets.length === 1 ? '' : 's'
            } met.`
          : breaches
              .map(
                (target) =>
                  `difficulty ${target.difficulty}: ${counts.get(String(target.difficulty)) ?? 0} (target ${formatRange(
                    target.min,
                    target.max
                  )})`
              )
              .join('; ') + '.',
    })
  }

  // -- Pattern diversity ------------------------------------------------------
  if (spec.minDistinctPatternKeys != null && spec.minDistinctPatternKeys > 0) {
    const distinct = new Set(questions.map((q) => q.patternKey).filter((value): value is string => Boolean(value)))
    checks.push({
      key: 'pattern_diversity',
      label: 'Pattern variety',
      enforcement: enforcementFor(spec, 'pattern_diversity'),
      satisfied: distinct.size >= spec.minDistinctPatternKeys,
      detail: `${distinct.size} distinct pattern key${distinct.size === 1 ? '' : 's'} (need ${
        spec.minDistinctPatternKeys
      }).`,
    })
  }

  // -- Answer balance ---------------------------------------------------------
  if (spec.maxAnswerShare != null && spec.maxAnswerShare > 0) {
    const answered = questions.filter((q) => q.correctOptionLabel)
    const counts = countBy(answered, (q) => q.correctOptionLabel)
    let topLabel = ''
    let topCount = 0
    for (const [label, count] of counts) {
      if (label && count > topCount) {
        topLabel = label
        topCount = count
      }
    }
    const share = answered.length > 0 ? topCount / answered.length : 0
    checks.push({
      key: 'answer_balance',
      label: 'Answer distribution',
      enforcement: enforcementFor(spec, 'answer_balance'),
      satisfied: share <= spec.maxAnswerShare,
      detail:
        answered.length === 0
          ? 'No multiple-choice answers to balance.'
          : `Answer ${topLabel || '?'} is ${(share * 100).toFixed(0)}% of options (max ${(
              spec.maxAnswerShare * 100
            ).toFixed(0)}%).`,
    })
  }

  const hardViolations = checks.filter((check) => check.enforcement === 'hard' && !check.satisfied).length
  const softWarnings = checks.filter((check) => check.enforcement === 'soft' && !check.satisfied).length

  return {
    blueprintId: meta.blueprintId ?? null,
    blueprintTitle: meta.blueprintTitle ?? null,
    checks,
    hardViolations,
    softWarnings,
    satisfied: hardViolations === 0,
  }
}

function countBy<T>(items: T[], selector: (item: T) => string | null): Map<string, number> {
  const counts = new Map<string, number>()
  for (const item of items) {
    const key = selector(item)
    if (key == null || key === '') continue
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return counts
}

function formatRange(min?: number, max?: number): string {
  if (min != null && max != null) return min === max ? `${min}` : `${min}–${max}`
  if (min != null) return `≥${min}`
  if (max != null) return `≤${max}`
  return 'any'
}
