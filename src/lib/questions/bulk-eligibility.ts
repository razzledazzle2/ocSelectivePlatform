import type { BulkQuestionFailureCode } from '@/lib/types'

export interface EligibilityPartition {
  /** Ids that need a write to reach the target state. */
  toUpdateIds: string[]
  /** Ids already in the target state — idempotent no-ops, still counted as succeeded. */
  alreadyDoneIds: string[]
  failed: BulkQuestionFailureCode[]
}

function failure(questionId: string, code: BulkQuestionFailureCode['code'], reason: string): BulkQuestionFailureCode {
  return { questionId, code, reason }
}

/** Ids that were requested but never came back from the DB fetch (deleted concurrently, bad id, RLS-hidden). */
export function partitionMissingIds(requestedIds: readonly string[], foundIds: ReadonlySet<string>): BulkQuestionFailureCode[] {
  return requestedIds
    .filter((id) => !foundIds.has(id))
    .map((id) => failure(id, 'not_found', 'This question could not be found.'))
}

export interface TrashCandidateRow {
  id: string
  status: string
  deletedAt: string | null
}

/**
 * Mirrors softDeleteQuestion's single-row guard: only an archived, not-yet-trashed
 * question can move to trash. An already-trashed question is treated as an
 * idempotent success (matching the single-row function's early return), not a
 * failure — so re-running trash on a mixed selection never reports a false error
 * for rows that are already exactly where the admin wants them.
 */
export function partitionTrashEligibility(rows: readonly TrashCandidateRow[]): EligibilityPartition {
  const toUpdateIds: string[] = []
  const alreadyDoneIds: string[] = []
  const failed: BulkQuestionFailureCode[] = []

  for (const row of rows) {
    if (row.deletedAt) {
      alreadyDoneIds.push(row.id)
    } else if (row.status !== 'archived') {
      failed.push(failure(row.id, 'not_archived', 'Only archived questions can be moved to trash. Archive it first.'))
    } else {
      toUpdateIds.push(row.id)
    }
  }

  return { toUpdateIds, alreadyDoneIds, failed }
}

export interface PublishCandidateRow {
  id: string
  status: string
  /** Count of linked question/option assets that are pending/rejected/missing a status — mirrors countUnreadyQuestionAssets. */
  unreadyAssetCount: number
}

/**
 * Mirrors publishQuestion's assertAssetsReadyForPublish guard (never let a
 * question with a pending/rejected required diagram reach students) plus the
 * row-menu's UI-only rule that an archived question can't be published
 * directly (it has no "Publish" affordance while archived — restore/unarchive
 * first). Already-published rows are treated as idempotent successes.
 */
export function partitionPublishEligibility(rows: readonly PublishCandidateRow[]): EligibilityPartition {
  const toUpdateIds: string[] = []
  const alreadyDoneIds: string[] = []
  const failed: BulkQuestionFailureCode[] = []

  for (const row of rows) {
    if (row.status === 'published') {
      alreadyDoneIds.push(row.id)
    } else if (row.status === 'archived') {
      failed.push(failure(row.id, 'archived_blocks_publish', 'Archived questions cannot be published directly. Restore it first.'))
    } else if (row.unreadyAssetCount > 0) {
      failed.push(
        failure(
          row.id,
          'assets_not_ready',
          `This question has ${row.unreadyAssetCount} pending or rejected asset${row.unreadyAssetCount === 1 ? '' : 's'}.`
        )
      )
    } else {
      toUpdateIds.push(row.id)
    }
  }

  return { toUpdateIds, alreadyDoneIds, failed }
}
