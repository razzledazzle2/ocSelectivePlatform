'use server'

import { revalidatePath } from 'next/cache'

import { requireProfile } from '@/lib/auth/require-profile'
import {
  archiveQuestion,
  createQuestion,
  parseQuestionWriteInput,
  publishQuestion,
  unpublishQuestion,
  updateQuestion,
} from '@/lib/questions/mutations'
import type { ActionResult } from '@/lib/types'

function revalidateQuestionPaths(questionId: string) {
  revalidatePath('/admin/questions')
  revalidatePath(`/admin/questions/${questionId}/edit`)
  revalidatePath(`/admin/questions/${questionId}/preview`)
  revalidatePath('/student/practice')
  revalidatePath('/student/dashboard')
  revalidatePath('/student/revision')
}

export async function createQuestionAction(formData: FormData): Promise<ActionResult<{ redirectTo: string }>> {
  const profile = await requireProfile({
    allowedRoles: ['admin', 'super_admin'],
  })
  const parsed = parseQuestionWriteInput(formData)

  if (!parsed.success || !parsed.data) {
    return {
      success: false,
      message: parsed.message,
      fieldErrors: parsed.fieldErrors,
    }
  }

  try {
    const questionId = await createQuestion(parsed.data, profile.id)
    revalidateQuestionPaths(questionId)

    return {
      success: true,
      message: 'Question created successfully.',
      data: {
        redirectTo: `/admin/questions/${questionId}/preview`,
      },
    }
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unable to create the question right now.',
    }
  }
}

export async function updateQuestionAction(
  questionId: string,
  formData: FormData
): Promise<ActionResult<{ redirectTo: string }>> {
  const profile = await requireProfile({
    allowedRoles: ['admin', 'super_admin'],
  })
  const parsed = parseQuestionWriteInput(formData)

  if (!parsed.success || !parsed.data) {
    return {
      success: false,
      message: parsed.message,
      fieldErrors: parsed.fieldErrors,
    }
  }

  try {
    await updateQuestion(questionId, parsed.data, profile.id)
    revalidateQuestionPaths(questionId)

    return {
      success: true,
      message: 'Question updated successfully.',
      data: {
        redirectTo: `/admin/questions/${questionId}/preview`,
      },
    }
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unable to save the question right now.',
    }
  }
}

export async function archiveQuestionAction(questionId: string): Promise<ActionResult> {
  const profile = await requireProfile({
    allowedRoles: ['admin', 'super_admin'],
  })

  try {
    await archiveQuestion(questionId, profile.id)
    revalidateQuestionPaths(questionId)

    return {
      success: true,
      message: 'Question archived.',
    }
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unable to archive the question right now.',
    }
  }
}

export async function publishQuestionAction(questionId: string): Promise<ActionResult> {
  const profile = await requireProfile({
    allowedRoles: ['admin', 'super_admin'],
  })

  try {
    await publishQuestion(questionId, profile.id)
    revalidateQuestionPaths(questionId)

    return {
      success: true,
      message: 'Question published.',
    }
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unable to publish the question right now.',
    }
  }
}

export async function unpublishQuestionAction(questionId: string): Promise<ActionResult> {
  const profile = await requireProfile({
    allowedRoles: ['admin', 'super_admin'],
  })

  try {
    await unpublishQuestion(questionId, profile.id)
    revalidateQuestionPaths(questionId)

    return {
      success: true,
      message: 'Question moved back to draft.',
    }
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unable to unpublish the question right now.',
    }
  }
}
