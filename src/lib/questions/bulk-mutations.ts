import { chunkIds } from '@/lib/questions/bulk-chunking'
import {
  partitionMissingIds,
  partitionPublishEligibility,
  partitionTrashEligibility,
  type PublishCandidateRow,
  type TrashCandidateRow,
} from '@/lib/questions/bulk-eligibility'
import { NOT_READY_ASSET_STATUSES } from '@/lib/questions/queries'
import { removeUploadedAssets } from '@/lib/assets/upload'
import { createClient } from '@/lib/supabase/server'
import { BULK_QUESTION_CHUNK_SIZE, type BulkQuestionFailureCode, type BulkQuestionMutationResult, type HardDeletePreview } from '@/lib/types'

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>

function buildResult(
  requestedCount: number,
  succeededIds: string[],
  failed: BulkQuestionFailureCode[],
  warnings?: BulkQuestionMutationResult['warnings']
): BulkQuestionMutationResult {
  return {
    requestedCount,
    matchedCount: requestedCount,
    succeededCount: succeededIds.length,
    succeededIds,
    failed,
    warnings,
  }
}

/**
 * Chunked, unconditional `.update().in('id', chunk).select('id')` — for the
 * operations whose single-row mutation (archiveQuestion, restoreQuestion,
 * unpublishQuestion, markQuestionReviewed) has no precondition at all: any
 * status can transition, and re-applying the same update to a row already in
 * the target state is a harmless no-op there too. `.select('id')` turns the
 * update into its own eligibility check for free — ids that don't come back
 * simply didn't exist, reported as `not_found` — so this needs exactly one
 * statement per chunk, matching the target architecture (250 questions → one
 * update; 501 → three: 250, 250, 1).
 */
async function chunkedUnconditionalUpdate(
  supabase: SupabaseServerClient,
  ids: string[],
  payload: Record<string, unknown>
): Promise<{ succeededIds: string[]; failed: BulkQuestionFailureCode[] }> {
  const succeededIds: string[] = []
  const failed: BulkQuestionFailureCode[] = []

  for (const chunk of chunkIds(ids, BULK_QUESTION_CHUNK_SIZE)) {
    const { data, error } = await supabase.from('questions').update(payload).in('id', chunk).select('id')

    if (error) {
      for (const id of chunk) {
        failed.push({ questionId: id, code: 'unexpected_error', reason: 'Unable to update this question right now.' })
      }
      continue
    }

    const updated = new Set(((data ?? []) as Array<{ id: string }>).map((row) => row.id))
    for (const id of chunk) {
      if (updated.has(id)) {
        succeededIds.push(id)
      } else {
        failed.push({ questionId: id, code: 'not_found', reason: 'This question could not be found.' })
      }
    }
  }

  return { succeededIds, failed }
}

export async function bulkArchiveQuestions(ids: string[], actorId: string): Promise<BulkQuestionMutationResult> {
  const supabase = await createClient()
  const { succeededIds, failed } = await chunkedUnconditionalUpdate(supabase, ids, {
    status: 'archived',
    archived_at: new Date().toISOString(),
    updated_by: actorId,
  })
  return buildResult(ids.length, succeededIds, failed)
}

export async function bulkRestoreQuestions(ids: string[], actorId: string): Promise<BulkQuestionMutationResult> {
  const supabase = await createClient()
  const { succeededIds, failed } = await chunkedUnconditionalUpdate(supabase, ids, {
    deleted_at: null,
    deleted_by: null,
    delete_reason: null,
    updated_by: actorId,
  })
  return buildResult(ids.length, succeededIds, failed)
}

export async function bulkUnpublishQuestions(ids: string[], actorId: string): Promise<BulkQuestionMutationResult> {
  const supabase = await createClient()
  const { succeededIds, failed } = await chunkedUnconditionalUpdate(supabase, ids, {
    status: 'draft',
    published_at: null,
    archived_at: null,
    updated_by: actorId,
  })
  return buildResult(ids.length, succeededIds, failed)
}

export async function bulkMarkQuestionsReviewed(ids: string[], actorId: string): Promise<BulkQuestionMutationResult> {
  const supabase = await createClient()
  const { succeededIds, failed } = await chunkedUnconditionalUpdate(supabase, ids, {
    status: 'reviewed',
    published_at: null,
    archived_at: null,
    updated_by: actorId,
  })
  return buildResult(ids.length, succeededIds, failed)
}

/**
 * Trash (soft delete) preserves softDeleteQuestion's guard: only an archived,
 * not-yet-trashed question can move to trash. Each chunk is classified with
 * one SELECT (status + deleted_at), then only the eligible ids in that chunk
 * are updated — two statements per chunk instead of one, because unlike
 * archive/restore/unpublish this operation genuinely refuses invalid rows
 * rather than silently no-op-ing them.
 */
export async function bulkTrashQuestions(
  ids: string[],
  actorId: string,
  reason?: string | null
): Promise<BulkQuestionMutationResult> {
  const supabase = await createClient()
  const succeededIds: string[] = []
  const failed: BulkQuestionFailureCode[] = []

  for (const chunk of chunkIds(ids, BULK_QUESTION_CHUNK_SIZE)) {
    const { data, error } = await supabase.from('questions').select('id, status, deleted_at').in('id', chunk)
    if (error) {
      for (const id of chunk) {
        failed.push({ questionId: id, code: 'unexpected_error', reason: 'Unable to load this question right now.' })
      }
      continue
    }

    const rawRows = (data ?? []) as Array<{ id: string; status: string; deleted_at: string | null }>
    const rows: TrashCandidateRow[] = rawRows.map((row) => ({ id: row.id, status: row.status, deletedAt: row.deleted_at }))
    failed.push(...partitionMissingIds(chunk, new Set(rows.map((row) => row.id))))
    const { toUpdateIds, alreadyDoneIds, failed: blocked } = partitionTrashEligibility(rows)
    failed.push(...blocked)
    succeededIds.push(...alreadyDoneIds)

    if (toUpdateIds.length === 0) {
      continue
    }
    const { data: updated, error: updateError } = await supabase
      .from('questions')
      .update({ deleted_at: new Date().toISOString(), deleted_by: actorId, delete_reason: reason?.trim() || null, updated_by: actorId })
      .in('id', toUpdateIds)
      .select('id')

    if (updateError) {
      for (const id of toUpdateIds) {
        failed.push({ questionId: id, code: 'unexpected_error', reason: 'Unable to move this question to trash right now.' })
      }
      continue
    }
    succeededIds.push(...((updated ?? []) as Array<{ id: string }>).map((row) => row.id))
  }

  return buildResult(ids.length, succeededIds, failed)
}

/** Batched equivalent of countUnreadyQuestionAssets — one pair of queries for the whole chunk instead of one pair per question. */
async function getUnreadyAssetCounts(supabase: SupabaseServerClient, ids: string[]): Promise<Map<string, number>> {
  if (ids.length === 0) {
    return new Map()
  }
  const [{ data: linked }, { data: options }] = await Promise.all([
    supabase.from('question_assets').select('question_id, asset:assets(status)').in('question_id', ids),
    supabase.from('question_options').select('question_id, asset:assets(status)').in('question_id', ids).not('asset_id', 'is', null),
  ])

  const rows = [...(linked ?? []), ...(options ?? [])] as Array<{
    question_id: string
    asset: { status: string } | { status: string }[] | null
  }>

  const counts = new Map<string, number>()
  for (const row of rows) {
    const asset = Array.isArray(row.asset) ? row.asset[0] : row.asset
    const status = asset?.status
    if (!status || NOT_READY_ASSET_STATUSES.has(status)) {
      counts.set(row.question_id, (counts.get(row.question_id) ?? 0) + 1)
    }
  }
  return counts
}

/**
 * Publish preserves assertAssetsReadyForPublish's guard (never let a question
 * with a pending/rejected required diagram reach students) plus the row
 * menu's rule that an archived question has no direct publish path. Each
 * chunk: one status select, two asset-readiness selects (batched across the
 * whole chunk, same shape as the single-row check), then one conditional
 * update for the eligible ids.
 */
export async function bulkPublishQuestions(ids: string[], actorId: string): Promise<BulkQuestionMutationResult> {
  const supabase = await createClient()
  const succeededIds: string[] = []
  const failed: BulkQuestionFailureCode[] = []

  for (const chunk of chunkIds(ids, BULK_QUESTION_CHUNK_SIZE)) {
    const { data, error } = await supabase.from('questions').select('id, status, published_at').in('id', chunk)
    if (error) {
      for (const id of chunk) {
        failed.push({ questionId: id, code: 'unexpected_error', reason: 'Unable to load this question right now.' })
      }
      continue
    }

    const rows = (data ?? []) as Array<{ id: string; status: string; published_at: string | null }>
    failed.push(...partitionMissingIds(chunk, new Set(rows.map((row) => row.id))))

    const unreadyCounts = await getUnreadyAssetCounts(
      supabase,
      rows.filter((row) => row.status !== 'published' && row.status !== 'archived').map((row) => row.id)
    )
    const candidates: PublishCandidateRow[] = rows.map((row) => ({
      id: row.id,
      status: row.status,
      unreadyAssetCount: unreadyCounts.get(row.id) ?? 0,
    }))
    const { toUpdateIds, alreadyDoneIds, failed: blocked } = partitionPublishEligibility(candidates)
    failed.push(...blocked)
    succeededIds.push(...alreadyDoneIds)

    if (toUpdateIds.length === 0) {
      continue
    }
    const now = new Date().toISOString()
    // Every eligible id here is guaranteed draft/reviewed (never previously
    // published — see partitionPublishEligibility), so published_at is always
    // null going in; setting it to `now` for the whole chunk is equivalent to
    // publishQuestion's per-row `existing.published_at ?? now()` without
    // needing a row-by-row expression.
    const { data: updated, error: updateError } = await supabase
      .from('questions')
      .update({ status: 'published', published_at: now, archived_at: null, updated_by: actorId })
      .in('id', toUpdateIds)
      .select('id')

    if (updateError) {
      for (const id of toUpdateIds) {
        failed.push({ questionId: id, code: 'unexpected_error', reason: 'Unable to publish this question right now.' })
      }
      continue
    }
    succeededIds.push(...((updated ?? []) as Array<{ id: string }>).map((row) => row.id))
  }

  return buildResult(ids.length, succeededIds, failed)
}

// -- Permanent delete (RPC-backed) --------------------------------------------

interface ClassifyRpcResult {
  requestedCount: number
  existingIds: string[]
  missingIds: string[]
  invalidStateIds: string[]
  eligibleIds: string[]
  blocked: Array<{ questionId: string; reasons: string[] }>
}

interface HardDeleteRpcResult {
  requestedCount: number
  deletedIds: string[]
  deletedCount: number
  blocked: Array<{ questionId: string; reasons: string[] }>
  missingIds: string[]
  invalidStateIds: string[]
  orphanedAssets: Array<{ id: string; storagePath: string | null; externalUrl: string | null; assetType: string }>
}

const HARD_DELETE_REASON_TEXT: Record<string, string> = {
  student_attempts: 'has student attempts',
  revision_records: 'has revision records',
  mock_exam_sessions: 'is used in a mock exam session',
  curated_mock_tests: 'is used in a curated mock test',
}

function describeBlockedReasons(reasons: string[]): string {
  return reasons.map((reason) => HARD_DELETE_REASON_TEXT[reason] ?? reason).join(', ')
}

/** Read-only, server-authoritative preview for the permanent-delete confirmation dialog. Never mutates anything. */
export async function previewHardDeleteQuestions(ids: string[]): Promise<HardDeletePreview> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('classify_hard_delete_candidates', { p_question_ids: ids })

  if (error) {
    throw new Error('Unable to check which questions are eligible for permanent deletion.')
  }

  const result = data as unknown as ClassifyRpcResult
  return {
    requestedCount: result.requestedCount,
    eligibleIds: result.eligibleIds,
    missingIds: result.missingIds,
    blocked: result.blocked.map((entry) => ({
      questionId: entry.questionId,
      code: 'has_student_history',
      reason: `This question ${describeBlockedReasons(entry.reasons)} and cannot be permanently deleted.`,
    })),
  }
}

/**
 * Permanently deletes the eligible subset via the hard_delete_questions RPC —
 * eligibility is re-verified atomically inside that single statement, not
 * against the preview above, so a row that gained history between the preview
 * and this call is still protected (see the migration for the exact
 * mechanism). Orphaned assets are deleted inside the same transaction; their
 * storage objects are removed afterwards as a best-effort batch, since
 * Supabase Storage isn't part of the Postgres transaction — a storage
 * failure is reported as a warning but never rolls back the already-committed
 * question deletion.
 */
export async function bulkHardDeleteQuestions(ids: string[]): Promise<BulkQuestionMutationResult> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('hard_delete_questions', { p_question_ids: ids })

  if (error) {
    throw new Error('Unable to permanently delete these questions right now.')
  }

  const result = data as unknown as HardDeleteRpcResult
  const failed: BulkQuestionFailureCode[] = [
    ...result.missingIds.map((id) => ({ questionId: id, code: 'not_found' as const, reason: 'This question could not be found.' })),
    ...result.invalidStateIds.map((id) => ({
      questionId: id,
      code: 'not_archived' as const,
      reason: 'Only archived questions can be permanently deleted. Archive it first.',
    })),
    ...result.blocked.map((entry) => ({
      questionId: entry.questionId,
      code: 'has_student_history' as const,
      reason: `This question ${describeBlockedReasons(entry.reasons)} and cannot be permanently deleted.`,
    })),
  ]

  const warnings: BulkQuestionMutationResult['warnings'] = []
  const storagePaths = [...new Set(result.orphanedAssets.map((asset) => asset.storagePath).filter((path): path is string => Boolean(path)))]
  const retainedPublicAssets = result.orphanedAssets.filter((asset) => !asset.storagePath && asset.externalUrl)

  if (storagePaths.length > 0) {
    const { failedPaths } = await removeUploadedAssets(storagePaths)
    if (failedPaths.length > 0) {
      warnings.push({
        code: 'storage_cleanup_failed',
        message: `${failedPaths.length} uploaded file${failedPaths.length === 1 ? '' : 's'} could not be removed from storage and will need manual cleanup. The question deletion itself is still complete.`,
      })
    }
  }
  if (retainedPublicAssets.length > 0) {
    warnings.push({
      code: 'generated_asset_files_retained',
      message: `${retainedPublicAssets.length} generated diagram file${retainedPublicAssets.length === 1 ? '' : 's'} under public/question-assets/generated/ ${retainedPublicAssets.length === 1 ? 'is' : 'are'} no longer referenced by any question but ${retainedPublicAssets.length === 1 ? 'was' : 'were'} left in place — these are static files bundled with the app and are not deleted at runtime.`,
    })
  }

  return buildResult(result.requestedCount, result.deletedIds, failed, warnings.length > 0 ? warnings : undefined)
}
