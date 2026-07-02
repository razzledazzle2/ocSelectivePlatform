'use server'

import { revalidatePath } from 'next/cache'

import { requireProfile } from '@/lib/auth/require-profile'
import { getPracticeQuestions, getPublishedQuestionFeedback } from '@/lib/questions/queries'
import {
  createPracticeSession,
  saveQuestionAttempt,
  updatePracticeSessionResults,
} from '@/lib/practice/mutations'
import {
  EXAM_TYPES,
  QUESTION_OPTION_LABELS,
  STUDENT_PORTAL_ROLES,
  type AttemptFeedback,
  type ActionResult,
  type PracticeAnswerFeedback,
  type PracticeQuestionItem,
  type PracticeSessionSummary,
  type PracticeStartResult,
  type QuestionOptionLabel,
} from '@/lib/types'

const PRACTICE_QUESTION_LIMIT = 20

function parsePositiveNumber(value: string): number | null {
  const parsed = Number(value)
  return Number.isNaN(parsed) || parsed <= 0 ? null : parsed
}

/**
 * Phase 1B: load a batch of PUBLISHED questions for the chosen exam type, subject and topic.
 * This does NOT create a practice session or persist anything.
 */
export async function loadPracticeQuestionsAction(
  formData: FormData
): Promise<ActionResult<{ questions: PracticeQuestionItem[] }>> {
  await requireProfile({
    allowedRoles: [...STUDENT_PORTAL_ROLES],
  })

  const examType = String(formData.get('examType') ?? '').trim()
  const subjectId = String(formData.get('subjectId') ?? '').trim()
  const topicId = String(formData.get('topicId') ?? '').trim()

  if (!EXAM_TYPES.includes(examType as (typeof EXAM_TYPES)[number])) {
    return { success: false, message: 'Choose OC or Selective before starting practice.' }
  }

  if (!subjectId) {
    return { success: false, message: 'Choose a subject before starting practice.' }
  }

  if (!topicId) {
    return { success: false, message: 'Choose a topic before starting practice.' }
  }

  try {
    const questions = await getPracticeQuestions({
      examType: examType as (typeof EXAM_TYPES)[number],
      subjectId,
      topicId,
      limit: PRACTICE_QUESTION_LIMIT,
    })

    return {
      success: true,
      data: { questions },
      message: questions.length ? undefined : 'No published questions match this topic yet.',
    }
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unable to load practice questions right now.',
    }
  }
}

/**
 * Phase 1B: reveal whether a chosen answer is correct, plus the explanation and worked solution.
 * The correct answer is resolved server-side only when the student submits, and nothing is saved.
 */
export async function checkPracticeAnswerAction(
  questionId: string,
  selectedOptionLabel: string
): Promise<ActionResult<PracticeAnswerFeedback>> {
  await requireProfile({
    allowedRoles: [...STUDENT_PORTAL_ROLES],
  })

  if (!questionId || !QUESTION_OPTION_LABELS.includes(selectedOptionLabel as QuestionOptionLabel)) {
    return { success: false, message: 'Choose an option before submitting.' }
  }

  try {
    const feedback = await getPublishedQuestionFeedback(questionId)

    if (!feedback) {
      return { success: false, message: 'This question is no longer available.' }
    }

    return {
      success: true,
      data: {
        isCorrect: selectedOptionLabel === feedback.correctOptionLabel,
        correctOptionLabel: feedback.correctOptionLabel,
        shortExplanation: feedback.shortExplanation,
        workedSolution: feedback.workedSolution,
      },
    }
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unable to check your answer right now.',
    }
  }
}

export async function startPracticeAction(formData: FormData): Promise<ActionResult<PracticeStartResult>> {
  const profile = await requireProfile({
    allowedRoles: [...STUDENT_PORTAL_ROLES],
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
    allowedRoles: [...STUDENT_PORTAL_ROLES],
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
    allowedRoles: [...STUDENT_PORTAL_ROLES],
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
