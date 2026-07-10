import type { BlankCellBehavior, ImportMode, ImportSummary } from '@/lib/import/types'
import { createClient } from '@/lib/supabase/server'

export type ImportBatchFinalStatus = 'completed' | 'completed_with_errors' | 'failed'

export interface RecordImportBatchInput {
  filename: string
  mode: ImportMode
  blankCellBehavior: BlankCellBehavior
  uploadedBy: string
  summary: ImportSummary
  errorSummary: string[]
  finalStatus: ImportBatchFinalStatus
}

export interface ImportBatchRecord {
  id: string
  filename: string
  importMode: ImportMode
  blankCellBehavior: BlankCellBehavior
  uploadedByName: string | null
  questionsCreated: number
  questionsUpdated: number
  questionsUnchanged: number
  questionsRejected: number
  assetsUploaded: number
  assetsRejected: number
  errorSummary: string[]
  finalStatus: ImportBatchFinalStatus
  createdAt: string
}

/** Records one CSV/paste/zip import run for the admin "Import history" page. Never blocks the import itself. */
export async function recordImportBatch(input: RecordImportBatchInput): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase.from('import_batches').insert({
    filename: input.filename,
    import_mode: input.mode,
    blank_cell_behavior: input.blankCellBehavior,
    uploaded_by: input.uploadedBy,
    questions_created: input.summary.importedCount,
    questions_updated: input.summary.updatedCount,
    questions_unchanged: input.summary.unchangedCount,
    questions_rejected: input.summary.failedCount,
    assets_uploaded: input.summary.uploadedAssetCount,
    assets_rejected: input.summary.rejectedAssetCount,
    error_summary: input.errorSummary,
    final_status: input.finalStatus,
  })

  if (error) {
    // History is an audit trail, not load-bearing — a failure here must never mask a
    // successful import result from the admin.
    console.error('Unable to record import batch history:', error.message)
  }
}

interface ImportBatchRawRow {
  id: string
  filename: string
  import_mode: ImportMode
  blank_cell_behavior: BlankCellBehavior
  questions_created: number
  questions_updated: number
  questions_unchanged: number
  questions_rejected: number
  assets_uploaded: number
  assets_rejected: number
  error_summary: string[] | null
  final_status: ImportBatchFinalStatus
  created_at: string
  uploader: { full_name: string | null } | { full_name: string | null }[] | null
}

function getRelationValue<T>(value: T | T[] | null): T | null {
  if (Array.isArray(value)) {
    return value[0] ?? null
  }
  return value
}

/** Most recent import runs first, for the admin import-history page. */
export async function getImportBatches(limit = 50): Promise<ImportBatchRecord[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('import_batches')
    .select(
      `
      id,
      filename,
      import_mode,
      blank_cell_behavior,
      questions_created,
      questions_updated,
      questions_unchanged,
      questions_rejected,
      assets_uploaded,
      assets_rejected,
      error_summary,
      final_status,
      created_at,
      uploader:profiles!import_batches_uploaded_by_fkey(full_name)
    `
    )
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    throw new Error('Unable to load import history.')
  }

  return ((data ?? []) as unknown as ImportBatchRawRow[]).map((row) => ({
    id: row.id,
    filename: row.filename,
    importMode: row.import_mode,
    blankCellBehavior: row.blank_cell_behavior,
    uploadedByName: getRelationValue(row.uploader)?.full_name ?? null,
    questionsCreated: row.questions_created,
    questionsUpdated: row.questions_updated,
    questionsUnchanged: row.questions_unchanged,
    questionsRejected: row.questions_rejected,
    assetsUploaded: row.assets_uploaded,
    assetsRejected: row.assets_rejected,
    errorSummary: row.error_summary ?? [],
    finalStatus: row.final_status,
    createdAt: row.created_at,
  }))
}
