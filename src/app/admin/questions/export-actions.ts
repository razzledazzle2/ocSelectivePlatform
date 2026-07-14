'use server'

import { requireProfile } from '@/lib/auth/require-profile'
import { buildFullExportCsv } from '@/lib/questions/export-full-csv'
import { getQuestionsForFullExport } from '@/lib/questions/queries'
import { ADMIN_PORTAL_ROLES, type ActionResult, type AdminQuestionFilters } from '@/lib/types'

/**
 * Full round-trip CSV export of every question matching the current admin
 * filters (all pages). The output uses the v2 import header, so the file can
 * be edited offline and re-imported. Pass `questionIds` to export only the
 * selected rows instead of the whole filtered bank.
 */
export async function exportQuestionsCsvAction(
  filters: AdminQuestionFilters,
  questionIds?: string[]
): Promise<ActionResult<{ csv: string; count: number; filename: string }>> {
  await requireProfile({ allowedRoles: [...ADMIN_PORTAL_ROLES] })

  try {
    const idConstraint = questionIds ? { mode: 'in' as const, ids: questionIds } : null
    const rows = await getQuestionsForFullExport(filters, idConstraint)

    if (rows.length === 0) {
      return {
        success: false,
        message: questionIds ? 'No questions selected to export.' : 'No questions match the current filters.',
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
