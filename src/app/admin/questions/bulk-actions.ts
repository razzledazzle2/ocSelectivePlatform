'use server'

import { revalidatePath } from 'next/cache'

import { requireProfile } from '@/lib/auth/require-profile'
import {
  bulkArchiveQuestions,
  bulkHardDeleteQuestions,
  bulkMarkQuestionsReviewed,
  bulkPublishQuestions,
  bulkRestoreQuestions,
  bulkTrashQuestions,
  bulkUnpublishQuestions,
  previewHardDeleteQuestions,
} from '@/lib/questions/bulk-mutations'
import { getBulkSelectionPreview, resolveQuestionIdsForBulkAction } from '@/lib/questions/bulk-selection'
import {
  ADMIN_PORTAL_ROLES,
  type ActionResult,
  type AdminQuestionFilters,
  type BulkQuestionMutationResult,
  type BulkQuestionSelectionInput,
  type BulkSelectionPreview,
  type HardDeletePreview,
} from '@/lib/types'

/**
 * Revalidated once per bulk action regardless of how many questions changed —
 * the single-row actions in actions.ts also revalidate each question's own
 * `/edit`/`/preview` path, but a bulk action can touch hundreds of questions
 * at once and none of them are the page the admin is currently looking at (the
 * list), so that per-id fan-out is deliberately skipped here.
 */
function revalidateBulkQuestionPaths() {
  revalidatePath('/admin/questions')
  revalidatePath('/student/practice')
  revalidatePath('/student/dashboard')
  revalidatePath('/student/revision')
}

function bulkErrorResult(error: unknown, fallback: string): ActionResult<BulkQuestionMutationResult> {
  return { success: false, message: error instanceof Error ? error.message : fallback }
}

function summarize(result: BulkQuestionMutationResult, verb: string): string {
  if (result.failed.length === 0) {
    return `${result.succeededCount} question${result.succeededCount === 1 ? '' : 's'} ${verb}.`
  }
  return `${result.succeededCount} ${verb}, ${result.failed.length} could not be ${verb}.`
}

/** One requireProfile call, one server-side id resolution, one set-based mutation, one revalidation — see bulk-mutations.ts for the chunking. */
async function runBulkAction(
  selection: BulkQuestionSelectionInput,
  verb: string,
  mutate: (ids: string[], actorId: string) => Promise<BulkQuestionMutationResult>
): Promise<ActionResult<BulkQuestionMutationResult>> {
  const profile = await requireProfile({ allowedRoles: [...ADMIN_PORTAL_ROLES] })

  try {
    const resolved = await resolveQuestionIdsForBulkAction(selection)
    const requestedCount = selection.mode === 'explicit' ? selection.ids.length : resolved.matchedCount
    if (resolved.ids.length === 0) {
      return { success: false, message: 'No questions matched this selection.' }
    }

    const result = await mutate(resolved.ids, profile.id)
    result.requestedCount = requestedCount
    revalidateBulkQuestionPaths()

    return { success: result.failed.length === 0, message: summarize(result, verb), data: result }
  } catch (error) {
    return bulkErrorResult(error, `Unable to complete this bulk action right now.`)
  }
}

export async function bulkArchiveQuestionsAction(
  selection: BulkQuestionSelectionInput
): Promise<ActionResult<BulkQuestionMutationResult>> {
  return runBulkAction(selection, 'archived', bulkArchiveQuestions)
}

export async function bulkRestoreQuestionsAction(
  selection: BulkQuestionSelectionInput
): Promise<ActionResult<BulkQuestionMutationResult>> {
  return runBulkAction(selection, 'restored', bulkRestoreQuestions)
}

export async function bulkTrashQuestionsAction(
  selection: BulkQuestionSelectionInput
): Promise<ActionResult<BulkQuestionMutationResult>> {
  return runBulkAction(selection, 'moved to trash', (ids, actorId) => bulkTrashQuestions(ids, actorId))
}

export async function bulkPublishQuestionsAction(
  selection: BulkQuestionSelectionInput
): Promise<ActionResult<BulkQuestionMutationResult>> {
  return runBulkAction(selection, 'published', bulkPublishQuestions)
}

export async function bulkUnpublishQuestionsAction(
  selection: BulkQuestionSelectionInput
): Promise<ActionResult<BulkQuestionMutationResult>> {
  return runBulkAction(selection, 'moved back to draft', bulkUnpublishQuestions)
}

export async function bulkMarkQuestionsReviewedAction(
  selection: BulkQuestionSelectionInput
): Promise<ActionResult<BulkQuestionMutationResult>> {
  return runBulkAction(selection, 'marked as reviewed', bulkMarkQuestionsReviewed)
}

/** Server-authoritative matched count + cutoff for the "Select all N matching filters" banner. */
export async function getBulkSelectionPreviewAction(
  filters: AdminQuestionFilters
): Promise<ActionResult<BulkSelectionPreview>> {
  await requireProfile({ allowedRoles: [...ADMIN_PORTAL_ROLES] })
  try {
    const preview = await getBulkSelectionPreview(filters)
    return { success: true, data: preview }
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : 'Unable to count matching questions.' }
  }
}

/** Read-only preview for the permanent-delete confirmation dialog — resolves the selection but never mutates anything. */
export async function previewHardDeleteQuestionsAction(
  selection: BulkQuestionSelectionInput
): Promise<ActionResult<HardDeletePreview>> {
  await requireProfile({ allowedRoles: [...ADMIN_PORTAL_ROLES] })
  try {
    const resolved = await resolveQuestionIdsForBulkAction(selection)
    const preview = await previewHardDeleteQuestions(resolved.ids)
    return { success: true, data: preview }
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : 'Unable to preview this deletion.' }
  }
}

export async function bulkHardDeleteQuestionsAction(
  selection: BulkQuestionSelectionInput
): Promise<ActionResult<BulkQuestionMutationResult>> {
  const profile = await requireProfile({ allowedRoles: [...ADMIN_PORTAL_ROLES] })
  void profile // the RPC re-derives the actor's role from the session itself (SECURITY INVOKER)

  try {
    const resolved = await resolveQuestionIdsForBulkAction(selection)
    const requestedCount = selection.mode === 'explicit' ? selection.ids.length : resolved.matchedCount
    if (resolved.ids.length === 0) {
      return { success: false, message: 'No questions matched this selection.' }
    }

    const result = await bulkHardDeleteQuestions(resolved.ids)
    result.requestedCount = requestedCount
    revalidateBulkQuestionPaths()

    return {
      success: result.failed.length === 0,
      message: summarize(result, 'permanently deleted'),
      data: result,
    }
  } catch (error) {
    return bulkErrorResult(error, 'Unable to permanently delete these questions right now.')
  }
}
