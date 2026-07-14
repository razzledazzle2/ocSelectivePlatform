import { QUESTION_OPTION_LABELS, type AnswerFormat, type QuestionOptionLabel } from '@/lib/types'

/**
 * Central, subject-aware rules for how many answer options a question should
 * have. This is THE single place option-count policy lives — the manual form,
 * CSV import, and bulk paste import all read from here.
 *
 * Matching is by subject name/slug keyword so it works with whatever taxonomy
 * rows exist in the DB. The first matching rule wins; DEFAULT_OPTION_RULE
 * applies when nothing matches.
 */
export interface OptionCountRule {
  /** Human label used in warnings, e.g. "Mathematical Reasoning". */
  label: string
  /** Lower-cased keywords matched against the subject name or slug. */
  keywords: string[]
  /** Option counts that are valid for this subject. */
  allowedCounts: number[]
  /** The count admins are nudged towards (warning when different). */
  preferredCount: number
}

export const OPTION_COUNT_RULES: OptionCountRule[] = [
  {
    label: 'Mathematical Reasoning',
    keywords: ['mathematical reasoning', 'maths reasoning', 'math'],
    allowedCounts: [4, 5],
    preferredCount: 5,
  },
  {
    label: 'Thinking Skills',
    keywords: ['thinking skills', 'thinking'],
    allowedCounts: [4],
    preferredCount: 4,
  },
  {
    label: 'Reading',
    keywords: ['reading'],
    allowedCounts: [4],
    preferredCount: 4,
  },
  {
    label: 'English',
    keywords: ['english'],
    allowedCounts: [4],
    preferredCount: 4,
  },
  {
    label: 'Writing',
    keywords: ['writing'],
    allowedCounts: [4],
    preferredCount: 4,
  },
  {
    label: 'Vocabulary',
    keywords: ['vocabulary', 'vocab'],
    allowedCounts: [4],
    preferredCount: 4,
  },
]

export const DEFAULT_OPTION_RULE: OptionCountRule = {
  label: 'General',
  keywords: [],
  allowedCounts: [4, 5],
  preferredCount: 4,
}

/** Hard bounds regardless of subject — the DB supports labels A–E. */
export const MIN_OPTION_COUNT = Math.min(
  ...OPTION_COUNT_RULES.flatMap((rule) => rule.allowedCounts),
  ...DEFAULT_OPTION_RULE.allowedCounts
)
export const MAX_OPTION_COUNT = QUESTION_OPTION_LABELS.length

export function getOptionRuleForSubject(subjectNameOrSlug: string | null | undefined): OptionCountRule {
  const key = (subjectNameOrSlug ?? '').trim().toLowerCase()
  if (!key) {
    return DEFAULT_OPTION_RULE
  }
  return (
    OPTION_COUNT_RULES.find((rule) => rule.keywords.some((keyword) => key.includes(keyword))) ??
    DEFAULT_OPTION_RULE
  )
}

/** The option labels for a given count, always contiguous from A. */
export function labelsForCount(count: number): QuestionOptionLabel[] {
  return QUESTION_OPTION_LABELS.slice(0, count) as QuestionOptionLabel[]
}

export interface OptionCountCheck {
  /** Present when the count is outside the subject's allowed counts. */
  error?: string
  /** Present when the count is allowed but differs from the preferred count. */
  warning?: string
}

/**
 * Validates an option count against a subject's rule.
 * Allowed-but-not-preferred is a warning (e.g. a 4-option Maths Reasoning
 * question); a disallowed count is an error. Option-count rules only apply to
 * single_choice questions — extended_response questions must have none.
 */
export function checkOptionCount(
  subjectNameOrSlug: string | null | undefined,
  count: number,
  answerFormat: AnswerFormat = 'single_choice'
): OptionCountCheck {
  if (answerFormat !== 'single_choice') {
    return count > 0
      ? { error: 'Extended response questions must not have answer options.' }
      : {}
  }

  const rule = getOptionRuleForSubject(subjectNameOrSlug)

  if (count < MIN_OPTION_COUNT || count > MAX_OPTION_COUNT) {
    return {
      error: `Questions need between ${MIN_OPTION_COUNT} and ${MAX_OPTION_COUNT} options (got ${count}).`,
    }
  }

  if (!rule.allowedCounts.includes(count)) {
    const allowed = rule.allowedCounts.join(' or ')
    return {
      error: `${rule.label} questions must have ${allowed} options (got ${count}).`,
    }
  }

  if (count !== rule.preferredCount) {
    return {
      warning: `${rule.label} questions usually have ${rule.preferredCount} options — this one has ${count}.`,
    }
  }

  return {}
}
