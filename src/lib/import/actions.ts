'use server'

import { revalidatePath } from 'next/cache'

import { requireProfile } from '@/lib/auth/require-profile'
import { parseBulkPasteQuestions } from '@/lib/import/bulk-paste-parser'
import { parseCsvQuestions } from '@/lib/import/csv-parser'
import { importValidatedQuestions } from '@/lib/import/import-questions'
import { validateQuestionImportRows } from '@/lib/import/validation'
import {
  DEFAULT_IMPORT_SETTINGS,
  IMPORT_FORMAT_SOURCE,
  type ImportFormat,
  type ImportSettings,
  type ImportSummary,
  type ImportValidationResult,
  type QuestionImportRow,
} from '@/lib/import/types'
import {
  getExistingQuestionExternalIds,
  getExistingQuestionTexts,
  getExistingTags,
  getQuestionTypes,
  getQuestionVariants,
  getSubjects,
  getTopicsBySubject,
} from '@/lib/questions/queries'
import { getExistingStimulusExternalRefs } from '@/lib/stimuli/queries'
import { ADMIN_PORTAL_ROLES, type ActionResult } from '@/lib/types'

/** Merge partial client settings over the forgiving defaults so old callers stay safe. */
function resolveSettings(settings?: Partial<ImportSettings>): ImportSettings {
  return { ...DEFAULT_IMPORT_SETTINGS, ...settings }
}

function parseSource(source: string, format: ImportFormat): { rows: QuestionImportRow[]; error?: string } {
  return format === 'csv' ? parseCsvQuestions(source) : parseBulkPasteQuestions(source)
}

async function buildValidation(
  source: string,
  format: ImportFormat,
  settings: ImportSettings
): Promise<ImportValidationResult> {
  const parsed = parseSource(source, format)

  if (parsed.error) {
    return {
      format,
      totalRows: 0,
      importableCount: 0,
      readyCount: 0,
      warningCount: 0,
      errorCount: 0,
      duplicateCount: 0,
      rows: [],
      parseError: parsed.error,
    }
  }

  const [
    subjects,
    topics,
    questionTypes,
    questionVariants,
    existingQuestionTexts,
    existingTags,
    existingStimulusRefs,
    existingExternalIds,
  ] = await Promise.all([
    getSubjects(),
    getTopicsBySubject(),
    getQuestionTypes(),
    getQuestionVariants(),
    getExistingQuestionTexts(),
    getExistingTags(),
    getExistingStimulusExternalRefs(),
    getExistingQuestionExternalIds(),
  ])

  return validateQuestionImportRows(parsed.rows, {
    format,
    reference: {
      subjects,
      topics,
      questionTypes,
      questionVariants,
      existingTags,
      existingStimulusRefs,
      existingExternalIds,
    },
    existingQuestionTexts,
    settings,
  })
}

export async function previewImportAction(
  source: string,
  format: ImportFormat,
  settings?: Partial<ImportSettings>
): Promise<ActionResult<ImportValidationResult>> {
  await requireProfile({ allowedRoles: [...ADMIN_PORTAL_ROLES] })

  if (!source.trim()) {
    return { success: false, message: 'Add some content before previewing the import.' }
  }

  try {
    const result = await buildValidation(source, format, resolveSettings(settings))

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
  settings?: Partial<ImportSettings>
): Promise<ActionResult<ImportSummary>> {
  const profile = await requireProfile({ allowedRoles: [...ADMIN_PORTAL_ROLES] })

  if (!source.trim()) {
    return { success: false, message: 'There is nothing to import.' }
  }

  try {
    // Re-validate server-side so we never trust client-sent rows.
    const validation = await buildValidation(source, format, resolveSettings(settings))

    if (validation.parseError) {
      return { success: false, message: validation.parseError }
    }

    const resolvedRows = validation.rows
      .filter((row) => row.isImportable && row.resolved)
      .map((row) => row.resolved!)

    if (resolvedRows.length === 0) {
      return { success: false, message: 'No valid rows are ready to import. Fix the highlighted errors first.' }
    }

    const { summary, importedQuestionIds } = await importValidatedQuestions(
      resolvedRows,
      profile.id,
      IMPORT_FORMAT_SOURCE[format]
    )

    revalidatePath('/admin/questions')
    revalidatePath('/admin/taxonomy')
    revalidatePath('/admin/dashboard')
    revalidatePath('/student/practice')
    for (const questionId of importedQuestionIds) {
      revalidatePath(`/admin/questions/${questionId}/preview`)
    }

    const parts = [`Imported ${summary.importedCount} question${summary.importedCount === 1 ? '' : 's'}`]
    if (summary.createdTopicCount > 0) {
      parts.push(`created ${summary.createdTopicCount} topic${summary.createdTopicCount === 1 ? '' : 's'}`)
    }
    if (summary.createdQuestionTypeCount > 0) {
      parts.push(
        `created ${summary.createdQuestionTypeCount} question type${summary.createdQuestionTypeCount === 1 ? '' : 's'}`
      )
    }
    if (summary.createdVariantCount > 0) {
      parts.push(`created ${summary.createdVariantCount} variant${summary.createdVariantCount === 1 ? '' : 's'}`)
    }
    if (summary.createdStimulusCount > 0) {
      parts.push(`created ${summary.createdStimulusCount} stimul${summary.createdStimulusCount === 1 ? 'us' : 'i'}`)
    }
    if (summary.createdAssetCount > 0) {
      parts.push(`created ${summary.createdAssetCount} asset${summary.createdAssetCount === 1 ? '' : 's'}`)
    }
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
