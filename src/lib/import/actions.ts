'use server'

import { revalidatePath } from 'next/cache'

import { requireProfile } from '@/lib/auth/require-profile'
import { parseBulkPasteQuestions } from '@/lib/import/bulk-paste-parser'
import { parseCsvQuestions } from '@/lib/import/csv-parser'
import { importValidatedQuestions } from '@/lib/import/import-questions'
import { validateQuestionImportRows } from '@/lib/import/validation'
import {
  IMPORT_FORMAT_SOURCE,
  type ImportFormat,
  type ImportStatusMode,
  type ImportSummary,
  type ImportValidationResult,
  type QuestionImportRow,
} from '@/lib/import/types'
import {
  getExistingQuestionTexts,
  getQuestionTypes,
  getSubjects,
  getTopicsBySubject,
} from '@/lib/questions/queries'
import { ADMIN_PORTAL_ROLES, type ActionResult } from '@/lib/types'

function parseSource(source: string, format: ImportFormat): { rows: QuestionImportRow[]; error?: string } {
  return format === 'csv' ? parseCsvQuestions(source) : parseBulkPasteQuestions(source)
}

async function buildValidation(
  source: string,
  format: ImportFormat,
  statusMode: ImportStatusMode
): Promise<ImportValidationResult> {
  const parsed = parseSource(source, format)

  if (parsed.error) {
    return {
      format,
      totalRows: 0,
      readyCount: 0,
      warningCount: 0,
      errorCount: 0,
      duplicateCount: 0,
      rows: [],
      parseError: parsed.error,
    }
  }

  const [subjects, topics, questionTypes, existingQuestionTexts] = await Promise.all([
    getSubjects(),
    getTopicsBySubject(),
    getQuestionTypes(),
    getExistingQuestionTexts(),
  ])

  return validateQuestionImportRows(parsed.rows, {
    format,
    reference: { subjects, topics, questionTypes },
    existingQuestionTexts,
    statusMode,
  })
}

export async function previewImportAction(
  source: string,
  format: ImportFormat,
  statusMode: ImportStatusMode
): Promise<ActionResult<ImportValidationResult>> {
  await requireProfile({ allowedRoles: [...ADMIN_PORTAL_ROLES] })

  if (!source.trim()) {
    return { success: false, message: 'Add some content before previewing the import.' }
  }

  try {
    const result = await buildValidation(source, format, statusMode)

    if (result.parseError) {
      return { success: false, message: result.parseError }
    }

    return { success: true, data: result }
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unable to validate the import right now.',
    }
  }
}

export async function importQuestionsAction(
  source: string,
  format: ImportFormat,
  statusMode: ImportStatusMode
): Promise<ActionResult<ImportSummary>> {
  const profile = await requireProfile({ allowedRoles: [...ADMIN_PORTAL_ROLES] })

  if (!source.trim()) {
    return { success: false, message: 'There is nothing to import.' }
  }

  try {
    // Re-validate server-side so we never trust client-sent rows.
    const validation = await buildValidation(source, format, statusMode)

    if (validation.parseError) {
      return { success: false, message: validation.parseError }
    }

    const resolvedRows = validation.rows
      .filter((row) => row.isImportable && row.resolved)
      .map((row) => row.resolved!)

    if (resolvedRows.length === 0) {
      return { success: false, message: 'No valid rows are ready to import. Fix the highlighted issues first.' }
    }

    const { summary, importedQuestionIds } = await importValidatedQuestions(
      resolvedRows,
      profile.id,
      IMPORT_FORMAT_SOURCE[format]
    )

    revalidatePath('/admin/questions')
    revalidatePath('/admin/dashboard')
    revalidatePath('/student/practice')
    for (const questionId of importedQuestionIds) {
      revalidatePath(`/admin/questions/${questionId}/preview`)
    }

    const parts = [`Imported ${summary.importedCount} question${summary.importedCount === 1 ? '' : 's'}`]
    if (summary.skippedDuplicateCount > 0) {
      parts.push(`skipped ${summary.skippedDuplicateCount} duplicate${summary.skippedDuplicateCount === 1 ? '' : 's'}`)
    }
    if (summary.failedCount > 0) {
      parts.push(`${summary.failedCount} failed`)
    }

    return { success: true, data: summary, message: `${parts.join(', ')}.` }
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unable to import questions right now.',
    }
  }
}
