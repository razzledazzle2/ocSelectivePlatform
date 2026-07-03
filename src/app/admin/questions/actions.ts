'use server'

import { revalidatePath } from 'next/cache'

import { requireProfile } from '@/lib/auth/require-profile'
import {
  archiveQuestion,
  createQuestion,
  duplicateQuestion,
  parseQuestionWriteInput,
  publishQuestion,
  unpublishQuestion,
  updateQuestion,
} from '@/lib/questions/mutations'
import { getQuestionById, validateQuestionTaxonomy } from '@/lib/questions/queries'
import {
  ADMIN_PORTAL_ROLES,
  type ActionResult,
  type QuestionDetail,
} from '@/lib/types'

function revalidateQuestionPaths(questionId: string) {
  revalidatePath('/admin/questions')
  revalidatePath(`/admin/questions/${questionId}/edit`)
  revalidatePath(`/admin/questions/${questionId}/preview`)
  revalidatePath('/student/practice')
  revalidatePath('/student/dashboard')
  revalidatePath('/student/revision')
}

function revalidateQuestionCollections() {
  revalidatePath('/admin/dashboard')
  revalidatePath('/admin/questions')
  revalidatePath('/student/practice')
  revalidatePath('/student/dashboard')
}

export async function createQuestionAction(formData: FormData): Promise<ActionResult<{ redirectTo: string }>> {
  const profile = await requireProfile({
    allowedRoles: [...ADMIN_PORTAL_ROLES],
  })
  const parsed = parseQuestionWriteInput(formData)

  if (!parsed.success || !parsed.data) {
    return {
      success: false,
      message: parsed.message,
      fieldErrors: parsed.fieldErrors,
    }
  }

  const taxonomyErrors = await validateQuestionTaxonomy(
    parsed.data.subjectId,
    parsed.data.topicId,
    parsed.data.questionTypeId
  )

  if (Object.keys(taxonomyErrors).length > 0) {
    return {
      success: false,
      message: 'Please fix the highlighted fields and try again.',
      fieldErrors: taxonomyErrors,
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
    allowedRoles: [...ADMIN_PORTAL_ROLES],
  })
  const parsed = parseQuestionWriteInput(formData)

  if (!parsed.success || !parsed.data) {
    return {
      success: false,
      message: parsed.message,
      fieldErrors: parsed.fieldErrors,
    }
  }

  const taxonomyErrors = await validateQuestionTaxonomy(
    parsed.data.subjectId,
    parsed.data.topicId,
    parsed.data.questionTypeId
  )

  if (Object.keys(taxonomyErrors).length > 0) {
    return {
      success: false,
      message: 'Please fix the highlighted fields and try again.',
      fieldErrors: taxonomyErrors,
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
    allowedRoles: [...ADMIN_PORTAL_ROLES],
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
    allowedRoles: [...ADMIN_PORTAL_ROLES],
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
    allowedRoles: [...ADMIN_PORTAL_ROLES],
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

export async function getQuestionPreviewAction(
  questionId: string
): Promise<ActionResult<QuestionDetail>> {
  await requireProfile({
    allowedRoles: [...ADMIN_PORTAL_ROLES],
  })

  try {
    const question = await getQuestionById(questionId)

    if (!question) {
      return {
        success: false,
        message: 'This question could not be found.',
      }
    }

    return {
      success: true,
      data: question,
    }
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unable to load the question preview.',
    }
  }
}

export async function duplicateQuestionAction(
  questionId: string
): Promise<ActionResult<{ redirectTo: string }>> {
  const profile = await requireProfile({
    allowedRoles: [...ADMIN_PORTAL_ROLES],
  })

  try {
    const newId = await duplicateQuestion(questionId, profile.id, 'duplicate')
    revalidateQuestionCollections()

    return {
      success: true,
      message: 'Question duplicated as a draft.',
      data: { redirectTo: `/admin/questions/${newId}/edit` },
    }
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unable to duplicate the question right now.',
    }
  }
}

export async function createSimilarQuestionAction(
  questionId: string
): Promise<ActionResult<{ redirectTo: string }>> {
  const profile = await requireProfile({
    allowedRoles: [...ADMIN_PORTAL_ROLES],
  })

  try {
    const newId = await duplicateQuestion(questionId, profile.id, 'similar')
    revalidateQuestionCollections()

    return {
      success: true,
      message: 'Draft copy created. Edit it to make it different from the original.',
      data: { redirectTo: `/admin/questions/${newId}/edit` },
    }
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unable to create a similar question right now.',
    }
  }
}
