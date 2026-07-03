import { createClient } from '@/lib/supabase/server'
import {
  REPORT_STATUSES,
  REPORT_TYPES,
  type ReportStatus,
  type ReportType,
} from '@/lib/types'

export function isValidReportType(value: string): value is ReportType {
  return REPORT_TYPES.includes(value as ReportType)
}

export function isValidReportStatus(value: string): value is ReportStatus {
  return REPORT_STATUSES.includes(value as ReportStatus)
}

interface CreateReportInput {
  questionId: string
  reporterId: string
  reportType: ReportType
  message: string | null
}

export async function createQuestionReport(input: CreateReportInput): Promise<string> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('question_reports')
    .insert({
      question_id: input.questionId,
      reporter_id: input.reporterId,
      report_type: input.reportType,
      message: input.message,
    })
    .select('id')
    .single()

  if (error || !data) {
    throw new Error('Unable to submit this report.')
  }

  return data.id
}

/**
 * Updates a report's triage status. Moving to a terminal status (resolved or
 * dismissed) stamps resolved_by/resolved_at; moving back to open/in_review
 * clears them so the audit trail stays accurate.
 */
export async function updateReportStatus(
  reportId: string,
  status: ReportStatus,
  actorId: string
): Promise<void> {
  const supabase = await createClient()
  const isTerminal = status === 'resolved' || status === 'dismissed'

  const { error } = await supabase
    .from('question_reports')
    .update({
      status,
      resolved_by: isTerminal ? actorId : null,
      resolved_at: isTerminal ? new Date().toISOString() : null,
    })
    .eq('id', reportId)

  if (error) {
    throw new Error('Unable to update the report status.')
  }
}

export async function assignReport(reportId: string, assignedTo: string | null): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('question_reports')
    .update({ assigned_to: assignedTo })
    .eq('id', reportId)

  if (error) {
    throw new Error('Unable to assign this report.')
  }
}

export async function updateReportInternalNote(reportId: string, note: string | null): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('question_reports')
    .update({ internal_note: note })
    .eq('id', reportId)

  if (error) {
    throw new Error('Unable to save the internal note.')
  }
}
