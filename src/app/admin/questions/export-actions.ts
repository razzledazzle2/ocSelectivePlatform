'use server'

import { requireProfile } from '@/lib/auth/require-profile'
import { buildFullExportCsv } from '@/lib/questions/export-full-csv'
import { sanitizeQuestionIds } from '@/lib/questions/bulk-selection'
import { getQuestionsForFullExport } from '@/lib/questions/queries'
import {
  ADMIN_PORTAL_ROLES,
  type ActionResult,
  type AdminQuestionFilters,
  type BulkQuestionSelectionInput,
} from '@/lib/types'

/**
 * Full round-trip CSV export of every question matching the current admin
 * filters (all pages). The output uses the v2 import header, so the file can
 * be edited offline and re-imported. Pass `selection` to scope the export:
 * `explicit` exports exactly those checked rows; `allMatching` re-applies its
 * own frozen filter snapshot plus cutoff/exclusions (the same selection model
 * every other bulk action uses) instead of the live `filters` argument, so an
 * export triggered from the "select all N matching" banner can't silently
 * grow if the admin lingers. Omit `selection` to export everything currently
 * matching `filters` with no snapshot semantics (the plain toolbar "Export
 * CSV" button).
 */
export async function exportQuestionsCsvAction(
  filters: AdminQuestionFilters,
  selection?: BulkQuestionSelectionInput
): Promise<ActionResult<{ csv: string; count: number; filename: string }>> {
  await requireProfile({ allowedRoles: [...ADMIN_PORTAL_ROLES] })

  try {
    let rows

    if (!selection) {
      rows = await getQuestionsForFullExport(filters, null)
    } else if (selection.mode === 'explicit') {
      const ids = sanitizeQuestionIds(selection.ids)
      if (ids.length === 0) {
        return { success: false, message: 'No questions selected to export.' }
      }
      rows = await getQuestionsForFullExport(filters, { mode: 'in', ids })
    } else {
      rows = await getQuestionsForFullExport(selection.filters, null, {
        cutoffTimestamp: selection.cutoffTimestamp,
        excludeIds: sanitizeQuestionIds(selection.excludedIds),
      })
    }

    if (rows.length === 0) {
      return {
        success: false,
        message: selection ? 'No questions matched this selection.' : 'No questions match the current filters.',
      }
    }

    return {
      success: true,
      data: {
        csv: buildFullExportCsv(rows),
        count: rows.length,
        filename: `question-bank-full-export-${new Date().toISOString().slice(0, 10)}.csv`,
      },
      message: `Exported ${rows.length} question${rows.length === 1 ? '' : 's'}.`,
    }
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unable to export questions right now.',
    }
  }
}
