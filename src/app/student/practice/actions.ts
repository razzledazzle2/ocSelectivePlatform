'use server'

import { revalidatePath } from 'next/cache'

import { createClient } from '@/lib/supabase/server'
import { requireProfile } from '@/lib/auth/require-profile'
import {
  getPracticeQuestionPool,
  hydratePracticeQuestions,
  shuffleArray,
} from '@/lib/practice/queries'
import {
  createPracticeSession,
  saveQuestionAttempt,
  updatePracticeSessionResults,
} from '@/lib/practice/mutations'
import {
  EXAM_TYPES,
  PRACTICE_SET_MODES,
  QUESTION_OPTION_LABELS,
  STUDENT_PORTAL_ROLES,
  type AttemptFeedback,
  type ActionResult,
  type PracticeSessionSummary,
  type PracticeSetMode,
  type PracticeStartResult,
} from '@/lib/types'

function parsePositiveNumber(value: string): number | null {
  const parsed = Number(value)
  return Number.isNaN(parsed) || parsed <= 0 ? null : parsed
}

/** Question ids the student has ever attempted, and their unmastered mistakes. */
async function getStudentQuestionHistory(studentId: string): Promise<{
  attemptedIds: Set<string>
  mistakeIds: Set<string>
}> {
  const supabase = await createClient()
  const [attemptsResult, mistakesResult] = await Promise.all([
    supabase.from('question_attempts').select('question_id').eq('student_id', studentId),
    supabase
      .from('student_mistake_questions')
      .select('question_id')
      .eq('student_id', studentId)
      .neq('status', 'mastered'),
  ])

  return {
    attemptedIds: new Set((attemptsResult.data ?? []).map((row) => row.question_id)),
    mistakeIds: new Set((mistakesResult.data ?? []).map((row) => row.question_id)),
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

  const modeValue = String(formData.get('mode') ?? 'new').trim()
  const mode: PracticeSetMode = PRACTICE_SET_MODES.includes(modeValue as PracticeSetMode)
    ? (modeValue as PracticeSetMode)
    : 'new'

  try {
    const [pool, history] = await Promise.all([
      getPracticeQuestionPool({
        examType: examType as (typeof EXAM_TYPES)[number],
        subjectId,
        topicId,
        difficulty: difficulty ?? undefined,
      }),
      getStudentQuestionHistory(profile.id),
    ])

    const fresh = shuffleArray(pool.filter((question) => !history.attemptedIds.has(question.id)))
    const seen = shuffleArray(
      pool.filter(
        (question) => history.attemptedIds.has(question.id) && !history.mistakeIds.has(question.id)
      )
    )
    const mistakes = shuffleArray(pool.filter((question) => history.mistakeIds.has(question.id)))

    let picked: typeof pool
    if (mode === 'mistakes') {
      picked = mistakes.slice(0, limit)
      if (!picked.length) {
        return {
          success: true,
          message: 'No mistake-review questions match these filters. Try New or Mixed practice.',
          data: { sessionId: '', startedAt: new Date().toISOString(), questions: [] },
        }
      }
    } else if (mode === 'mixed') {
      // Half mistakes (when available), topped up with fresh questions, then repeats.
      const mistakeShare = mistakes.slice(0, Math.ceil(limit / 2))
      picked = shuffleArray(
        [...mistakeShare, ...fresh.slice(0, limit - mistakeShare.length)].concat(
          seen.slice(0, Math.max(0, limit - mistakeShare.length - fresh.length))
        )
      ).slice(0, limit)
    } else {
      // New questions first; top up with previously seen ones rather than dead-ending.
      picked = [...fresh, ...seen, ...mistakes].slice(0, limit)
    }

    const questions = await hydratePracticeQuestions(picked)

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
