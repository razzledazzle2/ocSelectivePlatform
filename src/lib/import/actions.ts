'use server'

import { revalidatePath } from 'next/cache'

import { requireProfile } from '@/lib/auth/require-profile'
import { parseImportPackage } from '@/lib/import/asset-package'
import { parseBulkPasteQuestions } from '@/lib/import/bulk-paste-parser'
import { parseCsvQuestions } from '@/lib/import/csv-parser'
import type { ImportBatchFinalStatus, ImportBatchRecord } from '@/lib/import/history'
import { getImportBatches, recordImportBatch } from '@/lib/import/history'
import { applyValidatedImport } from '@/lib/import/import-questions'
import { validateQuestionImportRows } from '@/lib/import/validation'
import {
  DEFAULT_IMPORT_SETTINGS,
  IMPORT_FORMAT_SOURCE,
  type ImportFormat,
  type ImportSettings,
  type ImportSummary,
  type ImportValidationResult,
  type QuestionImportRow,
  type UploadedAssetFile,
} from '@/lib/import/types'
import {
  getExistingQuestionExternalIds,
  getExistingQuestionTexts,
  getExistingTags,
  getQuestionSnapshotsByExternalIds,
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

const EMPTY_VALIDATION_RESULT: Omit<ImportValidationResult, 'format' | 'parseError'> = {
  totalRows: 0,
  importableCount: 0,
  readyCount: 0,
  warningCount: 0,
  errorCount: 0,
  duplicateCount: 0,
  createCount: 0,
  updateCount: 0,
  unchangedCount: 0,
  missingAssetCount: 0,
  invalidAssetCount: 0,
  resolvedAssetCount: 0,
  uploadedFileCount: 0,
  unusedAssetFiles: [],
  rows: [],
}

async function buildValidationFromRows(
  rows: QuestionImportRow[],
  format: ImportFormat,
  settings: ImportSettings,
  assetFiles: Map<string, UploadedAssetFile>
): Promise<ImportValidationResult> {
  const externalIds = rows.map((row) => row.externalId.trim()).filter(Boolean)

  const [
    subjects,
    topics,
    questionTypes,
    questionVariants,
    existingQuestionTexts,
    existingTags,
    existingStimulusRefs,
    existingExternalIds,
    existingByExternalId,
  ] = await Promise.all([
    getSubjects(),
    getTopicsBySubject(),
    getQuestionTypes(),
    getQuestionVariants(),
    getExistingQuestionTexts(),
    getExistingTags(),
    getExistingStimulusExternalRefs(),
    getExistingQuestionExternalIds(),
    getQuestionSnapshotsByExternalIds(externalIds),
  ])

  return validateQuestionImportRows(rows, {
    format,
    reference: {
      subjects,
      topics,
      questionTypes,
      questionVariants,
      existingTags,
      existingStimulusRefs,
      existingExternalIds,
      existingByExternalId,
    },
    existingQuestionTexts,
    settings,
    assetFiles,
  })
}

async function buildValidation(source: string, format: ImportFormat, settings: ImportSettings): Promise<ImportValidationResult> {
  const parsed = parseSource(source, format)

  if (parsed.error) {
    return { format, ...EMPTY_VALIDATION_RESULT, parseError: parsed.error }
  }

  return buildValidationFromRows(parsed.rows, format, settings, new Map())
}

/** Builds an import history error digest: blocked rows, then asset warnings/unused files — capped so one bad file doesn't produce an unbounded log. */
function buildErrorSummary(validation: ImportValidationResult, summary: ImportSummary, packageErrors: string[]): string[] {
  const rowErrors = validation.rows
    .filter((row) => !row.isImportable)
    .slice(0, 30)
    .map((row) => `Row ${row.rowNumber}: ${row.errors.map((issue) => issue.message).join('; ')}`)
  return [...packageErrors, ...rowErrors, ...summary.cleanupWarnings, ...summary.assetWarnings.slice(0, 20)].slice(0, 50)
}

function determineFinalStatus(summary: ImportSummary, hadBlockingErrors: boolean): ImportBatchFinalStatus {
  const wroteAnything = summary.importedCount > 0 || summary.updatedCount > 0
  if (!wroteAnything && (summary.failedCount > 0 || hadBlockingErrors)) {
    return 'failed'
  }
  return summary.failedCount > 0 || hadBlockingErrors ? 'completed_with_errors' : 'completed'
}

async function runImport(
  validation: ImportValidationResult,
  settings: ImportSettings,
  format: ImportFormat,
  assetFiles: Map<string, UploadedAssetFile>,
  actorId: string,
  filename: string,
  packageErrors: string[] = []
): Promise<ActionResult<ImportSummary>> {
  if (validation.importableCount === 0) {
    return { success: false, message: 'No valid rows are ready to import. Fix the highlighted errors first.' }
  }

  const executableRows = validation.rows
    .filter((row) => row.isImportable && row.resolved && (row.action === 'create' || row.action === 'update'))
    .map((row) => row.resolved!)
  const skippedDuplicateCount = validation.rows.filter((row) => row.action === 'skip_duplicate').length
  const unchangedCount = validation.rows.filter((row) => row.action === 'unchanged').length

  const { summary, importedQuestionIds, updatedQuestionIds } = await applyValidatedImport(
    executableRows,
    actorId,
    IMPORT_FORMAT_SOURCE[format],
    assetFiles
  )
  summary.skippedDuplicateCount += skippedDuplicateCount
  summary.unchangedCount += unchangedCount
  summary.unusedAssetFiles = validation.unusedAssetFiles

  revalidatePath('/admin/questions')
  revalidatePath('/admin/taxonomy')
  revalidatePath('/admin/dashboard')
  revalidatePath('/student/practice')
  for (const questionId of [...importedQuestionIds, ...updatedQuestionIds]) {
    revalidatePath(`/admin/questions/${questionId}/preview`)
  }

  const errorSummary = buildErrorSummary(validation, summary, packageErrors)
  await recordImportBatch({
    filename,
    mode: settings.mode,
    blankCellBehavior: settings.blankCellBehavior,
    uploadedBy: actorId,
    summary,
    errorSummary,
    finalStatus: determineFinalStatus(summary, validation.errorCount > 0),
  })

  const parts = [`Created ${summary.importedCount} question${summary.importedCount === 1 ? '' : 's'}`]
  if (summary.updatedCount > 0) parts.push(`updated ${summary.updatedCount}`)
  if (summary.unchangedCount > 0) parts.push(`${summary.unchangedCount} unchanged`)
  if (summary.createdTopicCount > 0) parts.push(`created ${summary.createdTopicCount} topic${summary.createdTopicCount === 1 ? '' : 's'}`)
  if (summary.createdQuestionTypeCount > 0) {
    parts.push(`created ${summary.createdQuestionTypeCount} question type${summary.createdQuestionTypeCount === 1 ? '' : 's'}`)
  }
  if (summary.createdVariantCount > 0) parts.push(`created ${summary.createdVariantCount} variant${summary.createdVariantCount === 1 ? '' : 's'}`)
  if (summary.createdStimulusCount > 0) parts.push(`created ${summary.createdStimulusCount} stimul${summary.createdStimulusCount === 1 ? 'us' : 'i'}`)
  if (summary.createdAssetCount > 0) parts.push(`created ${summary.createdAssetCount} asset${summary.createdAssetCount === 1 ? '' : 's'}`)
  if (summary.generatedAssetCount > 0) parts.push(`generated ${summary.generatedAssetCount} diagram${summary.generatedAssetCount === 1 ? '' : 's'}`)
  if (summary.uploadedAssetCount > 0) parts.push(`uploaded ${summary.uploadedAssetCount} asset file${summary.uploadedAssetCount === 1 ? '' : 's'}`)
  if (summary.reusedExistingAssetCount > 0) parts.push(`reused ${summary.reusedExistingAssetCount} existing object${summary.reusedExistingAssetCount === 1 ? '' : 's'}`)
  if (summary.duplicateChecksumCount > 0) parts.push(`reused ${summary.duplicateChecksumCount} duplicate image${summary.duplicateChecksumCount === 1 ? '' : 's'}`)
  if (summary.assetLinksCreated > 0) parts.push(`linked ${summary.assetLinksCreated} asset${summary.assetLinksCreated === 1 ? '' : 's'}`)
  if (summary.rejectedAssetCount > 0) parts.push(`${summary.rejectedAssetCount} asset${summary.rejectedAssetCount === 1 ? '' : 's'} rejected`)
  if (summary.skippedDuplicateCount > 0) parts.push(`skipped ${summary.skippedDuplicateCount} duplicate${summary.skippedDuplicateCount === 1 ? '' : 's'}`)
  if (summary.failedCount > 0) parts.push(`${summary.failedCount} failed`)

  return { success: true, data: summary, message: `${parts.join(', ')}.` }
}

// -- Plain CSV / bulk-paste text (no asset package) -------------------------------------------

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
    return { success: false, message: error instanceof Error ? error.message : 'Unable to validate the import right now.' }
  }
}

export async function importQuestionsAction(
  source: string,
  format: ImportFormat,
  settings?: Partial<ImportSettings>,
  filename?: string
): Promise<ActionResult<ImportSummary>> {
  const profile = await requireProfile({ allowedRoles: [...ADMIN_PORTAL_ROLES] })

  if (!source.trim()) {
    return { success: false, message: 'There is nothing to import.' }
  }

  try {
    const resolvedSettings = resolveSettings(settings)
    // Re-validate server-side so we never trust client-sent rows.
    const validation = await buildValidation(source, format, resolvedSettings)
    if (validation.parseError) {
      return { success: false, message: validation.parseError }
    }

    return await runImport(
      validation,
      resolvedSettings,
      format,
      new Map(),
      profile.id,
      filename ?? (format === 'csv' ? 'upload.csv' : 'pasted-questions.txt')
    )
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : 'Unable to import questions right now.' }
  }
}

// -- ZIP package (CSV alone was already covered above; this is CSV+zip or zip-with-csv) -------

function readSettingsField(formData: FormData): Partial<ImportSettings> {
  const raw = formData.get('settings')
  if (typeof raw !== 'string' || !raw.trim()) {
    return {}
  }
  try {
    return JSON.parse(raw) as Partial<ImportSettings>
  } catch {
    return {}
  }
}

async function parsePackageFormData(
  formData: FormData
): Promise<{ csvText: string; assetFiles: Map<string, UploadedAssetFile>; errors: string[]; filename: string }> {
  const packageFile = formData.get('package')
  const csvFile = formData.get('csvFile')
  const assetsZipFile = formData.get('assetsZip')

  if (packageFile instanceof File) {
    const zipBuffer = Buffer.from(await packageFile.arrayBuffer())
    const parsed = await parseImportPackage({ zipBuffer })
    return { ...parsed, filename: packageFile.name }
  }

  if (csvFile instanceof File) {
    const csvText = await csvFile.text()
    const extraZipBuffer = assetsZipFile instanceof File ? Buffer.from(await assetsZipFile.arrayBuffer()) : undefined
    const parsed = await parseImportPackage({ csvText, extraZipBuffer })
    return { ...parsed, filename: csvFile.name }
  }

  return { csvText: '', assetFiles: new Map(), errors: ['No file was uploaded.'], filename: 'upload' }
}

export async function previewImportZipAction(formData: FormData): Promise<ActionResult<ImportValidationResult>> {
  await requireProfile({ allowedRoles: [...ADMIN_PORTAL_ROLES] })

  try {
    const { csvText, assetFiles, errors } = await parsePackageFormData(formData)
    if (!csvText.trim()) {
      return { success: false, message: errors[0] ?? 'The uploaded file has no question data.' }
    }

    const parsed = parseCsvQuestions(csvText)
    if (parsed.error) {
      return { success: false, message: parsed.error }
    }

    const settings = resolveSettings(readSettingsField(formData))
    const result = await buildValidationFromRows(parsed.rows, 'csv', settings, assetFiles)
    return {
      success: true,
      data: result,
      message: errors.length > 0 ? errors.slice(0, 5).join(' ') : undefined,
    }
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : 'Unable to validate the import right now.' }
  }
}

export async function importQuestionsZipAction(formData: FormData): Promise<ActionResult<ImportSummary>> {
  const profile = await requireProfile({ allowedRoles: [...ADMIN_PORTAL_ROLES] })

  try {
    const { csvText, assetFiles, errors, filename } = await parsePackageFormData(formData)
    if (!csvText.trim()) {
      return { success: false, message: errors[0] ?? 'The uploaded file has no question data.' }
    }

    const parsed = parseCsvQuestions(csvText)
    if (parsed.error) {
      return { success: false, message: parsed.error }
    }

    const settings = resolveSettings(readSettingsField(formData))
    const validation = await buildValidationFromRows(parsed.rows, 'csv', settings, assetFiles)

    return await runImport(validation, settings, 'csv', assetFiles, profile.id, filename, errors)
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : 'Unable to import questions right now.' }
  }
}

// -- Import history -----------------------------------------------------------------------

export async function getImportHistoryAction(): Promise<ActionResult<ImportBatchRecord[]>> {
  await requireProfile({ allowedRoles: [...ADMIN_PORTAL_ROLES] })
  try {
    return { success: true, data: await getImportBatches() }
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : 'Unable to load import history.' }
  }
}
