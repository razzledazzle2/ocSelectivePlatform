'use server'

import { revalidatePath } from 'next/cache'

import { requireProfile } from '@/lib/auth/require-profile'
import { createClient } from '@/lib/supabase/server'
import { buildFullExportCsv } from '@/lib/questions/export-full-csv'
import { getQuestionsForFullExport } from '@/lib/questions/queries'
import { selectReferenceQuestions, type ReferenceExportOptions } from '@/lib/coverage/core'
import {
  ADMIN_PORTAL_ROLES,
  VALIDATION_STATUSES,
  type ActionResult,
  type AdminQuestionFilters,
  type ValidationStatus,
} from '@/lib/types'

export interface ReferenceExportScope {
  domainCode?: string
  subtopicCode?: string
}

/**
 * Deterministic reference-export of the questions matching a coverage row. The
 * output uses the round-trip v2 import header (via buildFullExportCsv), so it is
 * both a reference document and a re-importable file. NO AI — the subset is chosen
 * by the deterministic filters in selectReferenceQuestions.
 */
export async function exportReferenceCsvAction(
  scope: ReferenceExportScope,
  options: ReferenceExportOptions
): Promise<ActionResult<{ csv: string; count: number; filename: string }>> {
  await requireProfile({ allowedRoles: [...ADMIN_PORTAL_ROLES] })

  if (!scope.domainCode && !scope.subtopicCode) {
    return { success: false, message: 'A domain or subtopic is required for a reference export.' }
  }

  const filters: AdminQuestionFilters = {
    domainCode: scope.domainCode,
    subtopicCode: scope.subtopicCode,
    // "Published only" / "Validated only" are deterministic DB filters.
    status: options.publishedOnly ? 'published' : undefined,
    validationStatus: options.validatedOnly ? 'validated' : undefined,
  }

  try {
    const rows = await getQuestionsForFullExport(filters)
    const selected = selectReferenceQuestions(rows, options)

    if (selected.length === 0) {
      return { success: false, message: 'No questions match this reference export.' }
    }

    const scopeLabel = scope.subtopicCode ?? scope.domainCode ?? 'coverage'
    const filename = `reference-${scopeLabel}-${options.strategy}-${new Date()
      .toISOString()
      .slice(0, 10)}.csv`

    return {
      success: true,
      data: { csv: buildFullExportCsv(selected), count: selected.length, filename },
      message: `Prepared ${selected.length} reference question${selected.length === 1 ? '' : 's'}.`,
    }
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unable to build the reference export.',
    }
  }
}

/**
 * Marks a question's content sign-off state (validation_status). This is the
 * signal the coverage "usable" count and thresholds depend on. It does NOT touch
 * the publish lifecycle (status) or any question content.
 */
export async function setValidationStatusAction(
  questionId: string,
  validationStatus: ValidationStatus
): Promise<ActionResult<{ id: string; validationStatus: ValidationStatus }>> {
  const profile = await requireProfile({ allowedRoles: [...ADMIN_PORTAL_ROLES] })

  if (!(VALIDATION_STATUSES as readonly string[]).includes(validationStatus)) {
    return { success: false, message: 'Invalid validation status.' }
  }

  const supabase = await createClient()
  const validated = validationStatus === 'validated'
  const { error } = await supabase
    .from('questions')
    .update({
      validation_status: validationStatus,
      validated_at: validated ? new Date().toISOString() : null,
      validated_by: validated ? profile.id : null,
    })
    .eq('id', questionId)

  if (error) {
    return { success: false, message: 'Unable to update the validation status.' }
  }

  revalidatePath('/admin/coverage', 'layout')
  return {
    success: true,
    data: { id: questionId, validationStatus },
    message: validated ? 'Marked as validated.' : `Marked as ${validationStatus.replace('_', ' ')}.`,
  }
}
