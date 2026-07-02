'use server'

import { revalidatePath } from 'next/cache'

import { requireProfile } from '@/lib/auth/require-profile'
import { getPublishedPracticeQuestion } from '@/lib/questions/queries'
import { markMistakeUnderstood, retryMistake } from '@/lib/revision/mutations'
import {
  QUESTION_OPTION_LABELS,
  STUDENT_PORTAL_ROLES,
  type ActionResult,
  type PracticeQuestionItem,
  type QuestionOptionLabel,
  type RevisionRetryFeedback,
} from '@/lib/types'

export async function loadRevisionQuestionAction(
  questionId: string
): Promise<ActionResult<PracticeQuestionItem>> {
  await requireProfile({ allowedRoles: [...STUDENT_PORTAL_ROLES] })

  if (!questionId) {
    return { success: false, message: 'This question could not be found.' }
  }

  try {
    const question = await getPublishedPracticeQuestion(questionId)

    if (!question) {
      return { success: false, message: 'This question is no longer available.' }
    }

    return { success: true, data: question }
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unable to load this question right now.',
    }
  }
}

export async function retryMistakeAction(
  questionId: string,
  selectedOptionLabel: string,
  timeTakenSeconds = 0
): Promise<ActionResult<RevisionRetryFeedback>> {
  const profile = await requireProfile({ allowedRoles: [...STUDENT_PORTAL_ROLES] })

  if (!questionId || !QUESTION_OPTION_LABELS.includes(selectedOptionLabel as QuestionOptionLabel)) {
    return { success: false, message: 'Choose an option before submitting your retry.' }
  }

  try {
    const feedback = await retryMistake({
      studentId: profile.id,
      questionId,
      selectedOptionLabel: selectedOptionLabel as QuestionOptionLabel,
      timeTakenSeconds,
    })

    revalidatePath('/student/revision')
    revalidatePath('/student/dashboard')

    return { success: true, data: feedback }
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unable to save your retry right now.',
    }
  }
}

export async function markUnderstoodAction(questionId: string): Promise<ActionResult> {
  const profile = await requireProfile({ allowedRoles: [...STUDENT_PORTAL_ROLES] })

  if (!questionId) {
    return { success: false, message: 'This question could not be found.' }
  }

  try {
    await markMistakeUnderstood(profile.id, questionId)

    revalidatePath('/student/revision')
    revalidatePath('/student/dashboard')

    return { success: true, message: 'Marked as understood.' }
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unable to update this question right now.',
    }
  }
}
