/**
 * Pure, dependency-free reading-set logic: CSV set/pool grouping, complete-set
 * selection, grading, and practice-choice estimates. Kept free of `@/` VALUE
 * imports (only `import type`) so it runs under the repo's
 * `node --test --experimental-strip-types` runner. See src/lib/import/*.test.ts.
 */
import type { QuestionImportRow } from '@/lib/import/types'
import type {
  QuestionOptionLabel,
  ReadingPracticeChoice,
  ReadingSetQuestionResult,
} from '@/lib/types'

export interface QuestionSetGroup {
  title: string
  setType: string
  instructions: string
  feedbackMode: string
  completionMode: string
  interactionType: string
  stimulusExternalRef: string
  sharedOptionPoolRef: string
}

/**
 * Merges the reading-set definition columns across every row sharing one
 * question_set_id — like stimuli, the definition may live on any single row.
 */
export function mergeQuestionSetGroups(rows: QuestionImportRow[]): Map<string, QuestionSetGroup> {
  const groups = new Map<string, QuestionSetGroup>()

  for (const row of rows) {
    const ref = row.questionSetId.trim()
    if (!ref) continue

    const group =
      groups.get(ref) ??
      ({
        title: '',
        setType: '',
        instructions: '',
        feedbackMode: '',
        completionMode: '',
        interactionType: '',
        stimulusExternalRef: '',
        sharedOptionPoolRef: '',
      } satisfies QuestionSetGroup)

    if (!group.title && row.questionSetTitle.trim()) group.title = row.questionSetTitle.trim()
    if (!group.setType && row.questionSetType.trim()) group.setType = row.questionSetType.trim()
    if (!group.instructions && row.setInstructions.trim()) group.instructions = row.setInstructions.trim()
    if (!group.feedbackMode && row.setFeedbackMode.trim()) group.feedbackMode = row.setFeedbackMode.trim()
    if (!group.completionMode && row.setCompletionMode.trim())
      group.completionMode = row.setCompletionMode.trim()
    if (!group.interactionType && row.interactionType.trim())
      group.interactionType = row.interactionType.trim()
    if (!group.stimulusExternalRef && row.stimulusId.trim())
      group.stimulusExternalRef = row.stimulusId.trim()
    if (!group.sharedOptionPoolRef && row.sharedOptionPoolId.trim())
      group.sharedOptionPoolRef = row.sharedOptionPoolId.trim()

    groups.set(ref, group)
  }

  return groups
}

export interface SharedOptionPoolGroup {
  title: string
  /** Option texts in label order (index 0 = A …); first row with options wins. */
  optionTexts: string[]
}

/**
 * Merges the shared A–G sentence bank across rows sharing one
 * shared_option_pool_id. The first row carrying option cells defines the pool.
 */
export function mergeSharedOptionPoolGroups(
  rows: QuestionImportRow[]
): Map<string, SharedOptionPoolGroup> {
  const groups = new Map<string, SharedOptionPoolGroup>()

  for (const row of rows) {
    const ref = row.sharedOptionPoolId.trim()
    if (!ref) continue

    const group = groups.get(ref) ?? { title: '', optionTexts: [] }
    const populated = row.options.filter((option) => option.trim())
    if (group.optionTexts.length === 0 && populated.length > 0) {
      group.optionTexts = row.options.map((option) => option.trim())
    }
    if (!group.title && row.questionSetTitle.trim()) group.title = row.questionSetTitle.trim()
    groups.set(ref, group)
  }

  return groups
}

/**
 * Picks whole sets for reading practice. Takes the first `setCount` sets (or all
 * of them when `'all'`), and always keeps each chosen set COMPLETE — a set is
 * never partially included, so an N-question limit can never split a set.
 */
export function selectCompleteSets<T extends { questionIds: string[] }>(
  sets: T[],
  setCount: number | 'all'
): T[] {
  if (setCount === 'all') {
    return sets
  }
  return sets.slice(0, Math.max(1, Math.floor(setCount)))
}

export interface GradeInput {
  questionId: string
  selectedLabel: QuestionOptionLabel | null
  correctLabel: QuestionOptionLabel
  workedSolution: string
}

export interface GradeOutput {
  results: ReadingSetQuestionResult[]
  correctCount: number
  totalQuestions: number
}

/**
 * Grades a reading set's answers. Each child is graded individually; an
 * unanswered question is simply incorrect. Pure — no side effects — so the same
 * inputs always yield the same result (idempotent grading).
 */
export function gradeReadingSet(inputs: GradeInput[]): GradeOutput {
  const results: ReadingSetQuestionResult[] = inputs.map((input) => ({
    questionId: input.questionId,
    selectedOptionLabel: input.selectedLabel,
    correctOptionLabel: input.correctLabel,
    isCorrect: input.selectedLabel !== null && input.selectedLabel === input.correctLabel,
    workedSolution: input.workedSolution,
  }))

  return {
    results,
    correctCount: results.filter((result) => result.isCorrect).length,
    totalQuestions: results.length,
  }
}

/**
 * Builds the "1 set / 2 sets / full" choices for the setup screen from the
 * ordered per-set question counts. Only offers a choice the catalogue supports.
 */
export function buildReadingPracticeChoices(
  setQuestionCounts: number[],
  secondsPerQuestion: number
): ReadingPracticeChoice[] {
  const minutes = (questions: number): number =>
    Math.max(1, Math.round((questions * secondsPerQuestion) / 60))

  const choices: ReadingPracticeChoice[] = []
  const total = setQuestionCounts.length

  if (total >= 1) {
    const q = setQuestionCounts[0]
    choices.push({ key: '1', label: '1 passage set', setCount: 1, estimatedQuestions: q, estimatedMinutes: minutes(q) })
  }
  if (total >= 2) {
    const q = setQuestionCounts[0] + setQuestionCounts[1]
    choices.push({ key: '2', label: '2 passage sets', setCount: 2, estimatedQuestions: q, estimatedMinutes: minutes(q) })
  }
  if (total >= 1) {
    const q = setQuestionCounts.reduce((sum, count) => sum + count, 0)
    choices.push({
      key: 'all',
      label: `Full reading practice (${total} passage${total === 1 ? '' : 's'})`,
      setCount: 'all',
      estimatedQuestions: q,
      estimatedMinutes: minutes(q),
    })
  }

  return choices
}

/**
 * The shared-bank labels not yet assigned to any gap. Sentence insertion always
 * leaves at least one option unused (7 sentences for 6 gaps).
 */
export function sharedPoolUnusedLabels(
  poolLabels: QuestionOptionLabel[],
  assignedLabels: Array<QuestionOptionLabel | null>
): QuestionOptionLabel[] {
  const used = new Set(assignedLabels.filter((label): label is QuestionOptionLabel => label !== null))
  return poolLabels.filter((label) => !used.has(label))
}

/** What the student may see for a reading-set item. Correctness is HIDDEN until submission. */
export interface ReadingItemReveal {
  isCorrect: boolean | null
  correctOptionLabel: QuestionOptionLabel | null
  workedSolution: string | null
}

/**
 * Gates correctness/solution behind submission. Before a set is submitted this
 * returns all-null so no answer key can leak; after submission it exposes the
 * stored outcome. This is the single decision point for after_set feedback.
 */
export function readingItemReveal(
  isSubmitted: boolean,
  meta: { isCorrect: boolean | null; correctOptionLabel: QuestionOptionLabel | null; workedSolution: string }
): ReadingItemReveal {
  if (!isSubmitted) {
    return { isCorrect: null, correctOptionLabel: null, workedSolution: null }
  }
  return {
    isCorrect: meta.isCorrect,
    correctOptionLabel: meta.correctOptionLabel,
    workedSolution: meta.workedSolution,
  }
}

export type CorrectAnswerStatus = 'ok' | 'missing' | 'not_a_label' | 'out_of_range'

/**
 * Validates that a correct-answer letter points at a POPULATED option. Works for
 * any option count (A–G); `allLabels` is the full label domain in order and
 * `optionTexts` the populated options (empty ones already rejected upstream).
 */
export function correctAnswerStatus(
  optionTexts: string[],
  correctLabel: string,
  allLabels: readonly string[]
): CorrectAnswerStatus {
  const label = correctLabel.trim().toUpperCase()
  if (!label) {
    return 'missing'
  }
  if (!allLabels.includes(label)) {
    return 'not_a_label'
  }
  // The populated options occupy labels allLabels[0..optionTexts.length-1].
  const populatedLabels = allLabels.slice(0, optionTexts.length)
  if (optionTexts.length > 0 && !populatedLabels.includes(label)) {
    return 'out_of_range'
  }
  return 'ok'
}
