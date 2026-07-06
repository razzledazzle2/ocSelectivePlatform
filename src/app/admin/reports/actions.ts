'use server'

import { revalidatePath } from 'next/cache'

import { requireProfile } from '@/lib/auth/require-profile'
import { archiveQuestion } from '@/lib/questions/mutations'
import { getReportDetail } from '@/lib/reports/queries'
import {
  assignReport,
  isValidReportStatus,
  updateReportInternalNote,
  updateReportStatus,
} from '@/lib/reports/mutations'
import {
  ADMIN_PORTAL_ROLES,
  type ActionResult,
  type ReportDetail,
} from '@/lib/types'

const MAX_NOTE_LENGTH = 2000

function revalidateReportPaths() {
  revalidatePath('/admin/reports')
}

export async function updateReportStatusAction(reportId: string, status: string): Promise<ActionResult> {
  const profile = await requireProfile({ allowedRoles: [...ADMIN_PORTAL_ROLES] })

  if (!reportId || !isValidReportStatus(status)) {
    return { success: false, message: 'That report status is not valid.' }
  }

  try {
    await updateReportStatus(reportId, status, profile.id)
    revalidateReportPaths()
    return { success: true, message: 'Report updated.' }
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unable to update the report right now.',
    }
  }
}

export async function assignReportAction(reportId: string, assignedTo: string | null): Promise<ActionResult> {
  await requireProfile({ allowedRoles: [...ADMIN_PORTAL_ROLES] })

  if (!reportId) {
    return { success: false, message: 'That report could not be found.' }
  }

  try {
    await assignReport(reportId, assignedTo && assignedTo.trim() ? assignedTo : null)
    revalidateReportPaths()
    return { success: true, message: assignedTo ? 'Report assigned.' : 'Report unassigned.' }
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unable to assign the report right now.',
    }
  }
}

export async function saveReportNoteAction(reportId: string, note: string): Promise<ActionResult> {
  await requireProfile({ allowedRoles: [...ADMIN_PORTAL_ROLES] })

  if (!reportId) {
    return { success: false, message: 'That report could not be found.' }
  }

  const trimmed = note.trim()

  try {
    await updateReportInternalNote(reportId, trimmed ? trimmed.slice(0, MAX_NOTE_LENGTH) : null)
    revalidateReportPaths()
    return { success: true, message: 'Internal note saved.' }
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unable to save the note right now.',
    }
  }
}

export async function archiveReportedQuestionAction(questionId: string): Promise<ActionResult> {
  const profile = await requireProfile({ allowedRoles: [...ADMIN_PORTAL_ROLES] })

  if (!questionId) {
    return { success: false, message: 'That question could not be found.' }
  }

  try {
    await archiveQuestion(questionId, profile.id)
    revalidateReportPaths()
    revalidatePath('/admin/questions')
    revalidatePath('/student/practice')
    return { success: true, message: 'Question archived and hidden from students.' }
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unable to archive the question right now.',
    }
  }
}

export async function getReportDetailAction(questionId: string): Promise<ActionResult<ReportDetail>> {
  await requireProfile({ allowedRoles: [...ADMIN_PORTAL_ROLES] })

  if (!questionId) {
    return { success: false, message: 'That question could not be found.' }
  }

  try {
    const detail = await getReportDetail(questionId)
    if (!detail) {
      return { success: false, message: 'This question could not be found.' }
    }
    return { success: true, data: detail }
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unable to load the report details.',
    }
  }
}
