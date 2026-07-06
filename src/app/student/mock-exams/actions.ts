'use server'

import { revalidatePath } from 'next/cache'

import { requireProfile } from '@/lib/auth/require-profile'
import { createClient } from '@/lib/supabase/server'
import {
  MOCK_EXAM_CONFIGS,
  isMockExamType,
  resolveExamType,
  type MockExamType,
} from '@/lib/mock-exams/config'
import {
  createMockExamSession,
  createSectionedMockSession,
  saveMockAnswer,
  saveWritingDraft,
  startNextMockSection,
  submitMockExam,
  submitMockSection,
  type SubmitSectionResult,
} from '@/lib/mock-exams/mutations'
import { countAvailableMockQuestions } from '@/lib/mock-exams/queries'
import type { PrepareMockExamResult } from '@/lib/mock-exams/types'
import {
  EXAM_TYPES,
  QUESTION_OPTION_LABELS,
  STUDENT_PORTAL_ROLES,
  type ActionResult,
  type ExamType,
  type QuestionOptionLabel,
} from '@/lib/types'

interface MockExamSelection {
  mockType: MockExamType
  examType: ExamType
  subjectId: string | null
}

type SelectionValidation = MockExamSelection | { error: string }

function validateSelection(
  mockTypeValue: string,
  examTypeValue: string,
  subjectIdValue: string | null
): SelectionValidation {
  if (!isMockExamType(mockTypeValue)) {
    return { error: 'Choose a valid mock exam type.' }
  }

  if (!EXAM_TYPES.includes(examTypeValue as ExamType)) {
    return { error: 'Choose OC or Selective first.' }
  }

  const config = MOCK_EXAM_CONFIGS[mockTypeValue]
  const subjectId = config.requiresSubject ? subjectIdValue?.trim() || null : null

  if (config.requiresSubject && !subjectId) {
    return { error: 'Choose a subject for a subject mock exam.' }
  }

  return { mockType: mockTypeValue, examType: examTypeValue as ExamType, subjectId }
}

async function getSubjectName(subjectId: string | null): Promise<string | null> {
  if (!subjectId) {
    return null
  }

  const supabase = await createClient()
  const { data } = await supabase.from('subjects').select('name').eq('id', subjectId).maybeSingle()
  return data?.name ?? null
}

/** Checks how many questions are available and returns the config, without creating a session. */
export async function prepareMockExamAction(
  mockTypeValue: string,
  examTypeValue: string,
  subjectIdValue: string | null
): Promise<ActionResult<PrepareMockExamResult>> {
  await requireProfile({ allowedRoles: [...STUDENT_PORTAL_ROLES] })

  const validation = validateSelection(mockTypeValue, examTypeValue, subjectIdValue)
  if ('error' in validation) {
    return { success: false, message: validation.error }
  }

  const { mockType, examType, subjectId } = validation
  const config = MOCK_EXAM_CONFIGS[mockType]
  const effectiveExamType = resolveExamType(config, examType)

  try {
    const [availableQuestionCount, subjectName] = await Promise.all([
      countAvailableMockQuestions(effectiveExamType, subjectId),
      getSubjectName(subjectId),
    ])

    return {
      success: true,
      data: {
        mockType,
        mockName: config.name,
        examType: effectiveExamType,
        subjectId,
        subjectName,
        targetQuestionCount: config.questionCount,
        availableQuestionCount,
        timeLimitSeconds: config.timeLimitSeconds,
      },
    }
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unable to prepare this mock exam.',
    }
  }
}

/** Creates the session (starting the timer) and returns the session id to navigate to. */
export async function startMockExamAction(
  mockTypeValue: string,
  examTypeValue: string,
  subjectIdValue: string | null
): Promise<ActionResult<{ sessionId: string }>> {
  const profile = await requireProfile({ allowedRoles: [...STUDENT_PORTAL_ROLES] })

  const validation = validateSelection(mockTypeValue, examTypeValue, subjectIdValue)
  if ('error' in validation) {
    return { success: false, message: validation.error }
  }

  const { mockType, examType, subjectId } = validation

  try {
    const result =
      mockType === 'randomised_full'
        ? await createSectionedMockSession({ studentId: profile.id, chosenExamType: examType })
        : await createMockExamSession({
            studentId: profile.id,
            mockType,
            chosenExamType: examType,
            subjectId,
          })

    if (!result) {
      return {
        success: false,
        message: 'There are no published questions available for this mock exam yet.',
      }
    }

    revalidatePath('/student/mock-exams')

    return { success: true, data: { sessionId: result.sessionId } }
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unable to start this mock exam.',
    }
  }
}

export async function saveMockAnswerAction(input: {
  sessionId: string
  questionId: string
  selectedOptionLabel?: string | null
  isFlagged?: boolean
  timeSpentSeconds?: number
}): Promise<ActionResult> {
  const profile = await requireProfile({ allowedRoles: [...STUDENT_PORTAL_ROLES] })

  if (!input.sessionId || !input.questionId) {
    return { success: false, message: 'Unable to save your progress.' }
  }

  let selectedOptionLabel: QuestionOptionLabel | null | undefined
  if (input.selectedOptionLabel !== undefined) {
    if (input.selectedOptionLabel === null || input.selectedOptionLabel === '') {
      selectedOptionLabel = null
    } else if (QUESTION_OPTION_LABELS.includes(input.selectedOptionLabel as QuestionOptionLabel)) {
      selectedOptionLabel = input.selectedOptionLabel as QuestionOptionLabel
    } else {
      return { success: false, message: 'That answer choice is not valid.' }
    }
  }

  try {
    await saveMockAnswer({
      sessionId: input.sessionId,
      studentId: profile.id,
      questionId: input.questionId,
      selectedOptionLabel,
      isFlagged: input.isFlagged,
      timeSpentSeconds: input.timeSpentSeconds,
    })

    return { success: true }
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unable to save your progress.',
    }
  }
}

/** Submits one section of a sectioned mock; finalises the session after the last one. */
export async function submitMockSectionAction(input: {
  sessionId: string
  sectionId: string
  writingResponse?: string
  writingSubmittedForMarking?: boolean
}): Promise<ActionResult<SubmitSectionResult>> {
  const profile = await requireProfile({ allowedRoles: [...STUDENT_PORTAL_ROLES] })

  if (!input.sessionId || !input.sectionId) {
    return { success: false, message: 'This section could not be found.' }
  }

  try {
    const result = await submitMockSection({
      sessionId: input.sessionId,
      studentId: profile.id,
      sectionId: input.sectionId,
      writingResponse: input.writingResponse,
      writingSubmittedForMarking: input.writingSubmittedForMarking,
    })

    if (!result) {
      return { success: false, message: 'This mock exam could not be found.' }
    }

    if (result.finished) {
      revalidatePath('/student/mock-exams')
      revalidatePath('/student/dashboard')
      revalidatePath('/student/revision')
    }

    return { success: true, data: result }
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unable to submit this section.',
    }
  }
}

/** Starts the next pending section (skip break / break finished). */
export async function startNextMockSectionAction(
  sessionId: string
): Promise<ActionResult<{ sectionId: string }>> {
  const profile = await requireProfile({ allowedRoles: [...STUDENT_PORTAL_ROLES] })

  if (!sessionId) {
    return { success: false, message: 'This mock exam could not be found.' }
  }

  try {
    const result = await startNextMockSection({ sessionId, studentId: profile.id })

    if (!result) {
      return { success: false, message: 'There is no section left to start.' }
    }

    return { success: true, data: result }
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unable to start the next section.',
    }
  }
}

/** Autosaves the writing draft while the section is open. */
export async function saveWritingDraftAction(input: {
  sessionId: string
  sectionId: string
  writingResponse: string
}): Promise<ActionResult> {
  const profile = await requireProfile({ allowedRoles: [...STUDENT_PORTAL_ROLES] })

  if (!input.sessionId || !input.sectionId) {
    return { success: false, message: 'Unable to save your writing.' }
  }

  try {
    await saveWritingDraft({
      sessionId: input.sessionId,
      studentId: profile.id,
      sectionId: input.sectionId,
      writingResponse: input.writingResponse,
    })

    return { success: true }
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unable to save your writing.',
    }
  }
}

export async function submitMockExamAction(
  sessionId: string
): Promise<ActionResult<{ sessionId: string }>> {
  const profile = await requireProfile({ allowedRoles: [...STUDENT_PORTAL_ROLES] })

  if (!sessionId) {
    return { success: false, message: 'This mock exam could not be found.' }
  }

  try {
    const result = await submitMockExam(sessionId, profile.id)

    if (!result) {
      return { success: false, message: 'This mock exam could not be found.' }
    }

    revalidatePath('/student/mock-exams')
    revalidatePath('/student/dashboard')
    revalidatePath('/student/revision')

    return { success: true, data: { sessionId } }
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unable to submit this mock exam.',
    }
  }
}
