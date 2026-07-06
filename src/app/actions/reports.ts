'use server'

import { requireProfile } from '@/lib/auth/require-profile'
import { createQuestionReport, isValidReportType } from '@/lib/reports/mutations'
import type { ActionResult } from '@/lib/types'

const MAX_MESSAGE_LENGTH = 1000

/**
 * Submits a question report from an authenticated user. Any signed-in role can
 * report (students, tutors, admins); RLS pins reporter_id to auth.uid().
 */
export async function submitQuestionReportAction(formData: FormData): Promise<ActionResult> {
  const profile = await requireProfile()

  const questionId = String(formData.get('questionId') ?? '').trim()
  const reportType = String(formData.get('reportType') ?? '').trim()
  const rawMessage = String(formData.get('message') ?? '').trim()

  if (!questionId) {
    return { success: false, message: 'This report is missing its question.' }
  }

  if (!isValidReportType(reportType)) {
    return { success: false, message: 'Choose what kind of issue you noticed.' }
  }

  const message = rawMessage ? rawMessage.slice(0, MAX_MESSAGE_LENGTH) : null

  try {
    await createQuestionReport({
      questionId,
      reporterId: profile.id,
      reportType,
      message,
    })

    return {
      success: true,
      message: 'Thanks — your report was sent to our reviewers.',
    }
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unable to submit this report right now.',
    }
  }
}
