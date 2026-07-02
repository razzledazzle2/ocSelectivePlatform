'use server'

import { revalidatePath } from 'next/cache'

import { requireProfile } from '@/lib/auth/require-profile'
import { getPracticeQuestions } from '@/lib/questions/queries'
import {
  createPracticeSession,
  saveQuestionAttempt,
  updatePracticeSessionResults,
} from '@/lib/practice/mutations'
import {
  EXAM_TYPES,
  QUESTION_OPTION_LABELS,
  type AttemptFeedback,
  type ActionResult,
  type PracticeSessionSummary,
  type PracticeStartResult,
} from '@/lib/types'

function parsePositiveNumber(value: string): number | null {
  const parsed = Number(value)
  return Number.isNaN(parsed) || parsed <= 0 ? null : parsed
}

export async function startPracticeAction(formData: FormData): Promise<ActionResult<PracticeStartResult>> {
  const profile = await requireProfile({
    allowedRoles: ['student', 'admin', 'super_admin'],
  })
  const examType = String(formData.get('examType') ?? '').trim()
  const subjectId = String(formData.get('subjectId') ?? '').trim()
  const topicId = String(formData.get('topicId') ?? '').trim() || undefined
  const difficultyValue = String(formData.get('difficulty') ?? '').trim()
  const limitValue = String(formData.get('questionCount') ?? '').trim()
  const limit = parsePositiveNumber(limitValue)
  const difficulty = difficultyValue ? parsePositiveNumber(difficultyValue) : null

  if (!EXAM_TYPES.includes(examType as (typeof EXAM_TYPES)[number])) {
    return {
      success: false,
      message: 'Choose OC or Selective before starting practice.',
    }
  }

  if (!subjectId) {
    return {
      success: false,
      message: 'Choose a subject before starting practice.',
    }
  }

  if (!limit) {
    return {
      success: false,
      message: 'Choose how many questions you want to practise.',
    }
  }

  try {
    const questions = await getPracticeQuestions({
      examType: examType as (typeof EXAM_TYPES)[number],
      subjectId,
      topicId,
      difficulty: difficulty ?? undefined,
      limit,
    })

    if (!questions.length) {
      return {
        success: true,
        message: 'No published questions match these filters yet.',
        data: {
          sessionId: '',
          startedAt: new Date().toISOString(),
          questions: [],
        },
      }
    }

    const sessionId = await createPracticeSession({
      studentId: profile.id,
      examType,
      subjectId,
      topicId: topicId ?? null,
      difficulty,
      totalQuestions: questions.length,
    })

    return {
      success: true,
      data: {
        sessionId,
        startedAt: new Date().toISOString(),
        questions,
      },
    }
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unable to start practice right now.',
    }
  }
}

export async function savePracticeAttemptAction(
  formData: FormData
): Promise<ActionResult<AttemptFeedback>> {
  const profile = await requireProfile({
    allowedRoles: ['student', 'admin', 'super_admin'],
  })
  const sessionId = String(formData.get('sessionId') ?? '').trim()
  const questionId = String(formData.get('questionId') ?? '').trim()
  const selectedOptionLabel = String(formData.get('selectedOptionLabel') ?? '').trim()
  const timeTakenValue = String(formData.get('timeTakenSeconds') ?? '').trim()
  const timeTakenSeconds = parsePositiveNumber(timeTakenValue) ?? 0

  if (!sessionId || !questionId || !QUESTION_OPTION_LABELS.includes(selectedOptionLabel as never)) {
    return {
      success: false,
      message: 'Your answer could not be submitted. Please try again.',
    }
  }

  try {
    const feedback = await saveQuestionAttempt({
      sessionId,
      studentId: profile.id,
      questionId,
      selectedOptionLabel: selectedOptionLabel as (typeof QUESTION_OPTION_LABELS)[number],
      timeTakenSeconds,
    })

    revalidatePath('/student/dashboard')
    revalidatePath('/student/revision')

    return {
      success: true,
      data: feedback,
    }
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unable to save your answer right now.',
    }
  }
}

export async function completePracticeSessionAction(
  summary: PracticeSessionSummary
): Promise<ActionResult<{ sessionId: string }>> {
  await requireProfile({
    allowedRoles: ['student', 'admin', 'super_admin'],
  })

  if (!summary.sessionId || summary.totalQuestions < 0) {
    return {
      success: false,
      message: 'The practice summary is incomplete.',
    }
  }

  try {
    await updatePracticeSessionResults(summary.sessionId, {
      totalQuestions: summary.totalQuestions,
      correctCount: summary.correctCount,
      incorrectCount: summary.incorrectCount,
      accuracy: summary.accuracy,
      totalTimeSeconds: summary.totalTimeSeconds,
    })

    revalidatePath('/student/dashboard')
    revalidatePath('/student/revision')

    return {
      success: true,
      data: {
        sessionId: summary.sessionId,
      },
    }
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unable to finish the practice session right now.',
    }
  }
}
