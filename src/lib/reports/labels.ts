import type { ReportStatus, ReportType } from '@/lib/types'

/** Human-friendly labels for each report type, shared by student & admin UI. */
export const REPORT_TYPE_LABELS: Record<ReportType, string> = {
  wrong_answer: 'Wrong answer',
  unclear_solution: 'Unclear solution',
  typo: 'Typo',
  multiple_correct_answers: 'More than one answer seems correct',
  confusing_wording: 'Confusing wording',
  image_or_diagram_issue: 'Image or diagram issue',
  other: 'Other',
}

/** Shorter labels for compact table cells / badges. */
export const REPORT_TYPE_SHORT_LABELS: Record<ReportType, string> = {
  wrong_answer: 'Wrong answer',
  unclear_solution: 'Unclear solution',
  typo: 'Typo',
  multiple_correct_answers: 'Multiple correct',
  confusing_wording: 'Confusing wording',
  image_or_diagram_issue: 'Image issue',
  other: 'Other',
}

export const REPORT_STATUS_LABELS: Record<ReportStatus, string> = {
  open: 'Open',
  in_review: 'In review',
  resolved: 'Resolved',
  dismissed: 'Dismissed',
}
