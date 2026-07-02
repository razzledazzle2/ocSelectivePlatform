'use server'

import { revalidatePath } from 'next/cache'

import { requireProfile } from '@/lib/auth/require-profile'
import { validateQuestionCsvText } from '@/lib/csv/questions'
import { importQuestionsFromCsvRows } from '@/lib/questions/csv-import'
import {
  archiveQuestion,
  createQuestion,
  parseQuestionWriteInput,
  publishQuestion,
  unpublishQuestion,
  updateQuestion,
} from '@/lib/questions/mutations'
import {
  ADMIN_PORTAL_ROLES,
  type ActionResult,
  type CsvImportableQuestion,
  type QuestionCsvImportSummary,
  type QuestionCsvPreviewResult,
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

export async function previewQuestionCsvImportAction(
  formData: FormData
): Promise<ActionResult<QuestionCsvPreviewResult>> {
  await requireProfile({
    allowedRoles: [...ADMIN_PORTAL_ROLES],
  })

  const file = formData.get('file')

  if (!(file instanceof File) || !file.name.toLowerCase().endsWith('.csv')) {
    return {
      success: false,
      message: 'Upload a CSV file before previewing the import.',
    }
  }

  try {
    const preview = await validateQuestionCsvText(await file.text(), file.name)

    return {
      success: true,
      data: preview,
      message:
        preview.validRows.length === preview.totalRows
          ? 'CSV validated successfully.'
          : 'CSV parsed. Review the row-level issues before importing.',
    }
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unable to validate the uploaded CSV.',
    }
  }
}

export async function importQuestionCsvRowsAction(
  rows: CsvImportableQuestion[]
): Promise<ActionResult<QuestionCsvImportSummary>> {
  const profile = await requireProfile({
    allowedRoles: [...ADMIN_PORTAL_ROLES],
  })

  if (!rows.length) {
    return {
      success: false,
      message: 'There are no valid rows to import.',
    }
  }

  try {
    const summary = await importQuestionsFromCsvRows(rows, profile.id)
    revalidateQuestionCollections()

    for (const questionId of summary.importedQuestionIds) {
      revalidateQuestionPaths(questionId)
    }

    return {
      success: true,
      data: summary,
      message: `Imported ${summary.importedCount} question${summary.importedCount === 1 ? '' : 's'}${summary.skippedDuplicateCount ? ` and skipped ${summary.skippedDuplicateCount} duplicate${summary.skippedDuplicateCount === 1 ? '' : 's'}` : ''}.`,
    }
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unable to import the CSV right now.',
    }
  }
}
