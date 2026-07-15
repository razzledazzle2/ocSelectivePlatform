'use server'

import { revalidatePath } from 'next/cache'

import { requireProfile } from '@/lib/auth/require-profile'
import {
  autosaveReadingAnswer,
  startReadingPracticeSession,
  submitReadingSet,
} from '@/lib/question-sets/practice-mutations'
import {
  EXAM_TYPES,
  QUESTION_OPTION_LABELS,
  STUDENT_PORTAL_ROLES,
  type ActionResult,
  type ExamType,
  type QuestionOptionLabel,
  type ReadingSetSubmitResult,
} from '@/lib/types'

function isExamType(value: string): value is ExamType {
  return (EXAM_TYPES as readonly string[]).includes(value)
}

function parseOptionLabel(value: string): QuestionOptionLabel | null {
  const upper = value.trim().toUpperCase()
  return (QUESTION_OPTION_LABELS as readonly string[]).includes(upper) ? (upper as QuestionOptionLabel) : null
}

/** Starts a reading practice session covering 1, 2 or all passage sets. */
export async function startReadingPracticeAction(
  formData: FormData
): Promise<ActionResult<{ sessionId: string }>> {
  const profile = await requireProfile({ allowedRoles: [...STUDENT_PORTAL_ROLES] })

  const examType = String(formData.get('examType') ?? '').trim()
  const subjectId = String(formData.get('subjectId') ?? '').trim()
  const setCountRaw = String(formData.get('setCount') ?? '').trim()

  if (!isExamType(examType)) {
    return { success: false, message: 'Choose OC or Selective before starting.' }
  }
  if (!subjectId) {
    return { success: false, message: 'Choose a subject before starting.' }
  }

  const setCount: number | 'all' =
    setCountRaw === 'all' ? 'all' : Math.max(1, Number.parseInt(setCountRaw, 10) || 1)

  try {
    const result = await startReadingPracticeSession({
      studentId: profile.id,
      examType,
      subjectId,
      setCount,
    })

    if (!result) {
      return { success: false, message: 'No reading sets are available for this selection yet.' }
    }

    revalidatePath('/student/practice')
    return { success: true, data: { sessionId: result.sessionId } }
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unable to start reading practice.',
    }
  }
}

/** Autosaves a single answer mid-set (never grades, never reveals correctness). */
export async function autosaveReadingAnswerAction(input: {
  sessionId: string
  questionId: string
  selectedOptionLabel: string | null
  timeSpentSeconds: number
}): Promise<ActionResult> {
  const profile = await requireProfile({ allowedRoles: [...STUDENT_PORTAL_ROLES] })

  const selected = input.selectedOptionLabel ? parseOptionLabel(input.selectedOptionLabel) : null
  if (input.selectedOptionLabel && !selected) {
    return { success: false, message: 'That answer choice is not valid.' }
  }

  try {
    await autosaveReadingAnswer({
      sessionId: input.sessionId,
      studentId: profile.id,
      questionId: input.questionId,
      selectedOptionLabel: selected,
      timeSpentSeconds: Number.isFinite(input.timeSpentSeconds) ? input.timeSpentSeconds : 0,
    })
    return { success: true }
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unable to save your answer.',
    }
  }
}

/** Submits and grades one set (idempotent — never awards results twice). */
export async function submitReadingSetAction(input: {
  sessionId: string
  setId: string
}): Promise<ActionResult<ReadingSetSubmitResult>> {
  const profile = await requireProfile({ allowedRoles: [...STUDENT_PORTAL_ROLES] })

  try {
    const result = await submitReadingSet({
      sessionId: input.sessionId,
      studentId: profile.id,
      setId: input.setId,
    })

    if (!result) {
      return { success: false, message: 'This reading session could not be found.' }
    }

    revalidatePath(`/student/practice/reading/${input.sessionId}`)
    return { success: true, data: result }
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unable to submit this set.',
    }
  }
}
