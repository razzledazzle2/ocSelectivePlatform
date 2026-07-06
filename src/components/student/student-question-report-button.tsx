'use client'

import { QuestionReportDialog } from '@/components/student/question-report-dialog'

interface StudentQuestionReportButtonProps {
  questionId: string
  variant?: 'ghost' | 'outline'
  size?: 'sm' | 'default'
  label?: string
  className?: string
}

/**
 * Convenience wrapper around {@link QuestionReportDialog}: renders a single
 * "Report issue" trigger button anywhere a student is answering or reviewing a
 * question. Kept thin so the dialog logic lives in one place.
 */
export function StudentQuestionReportButton({
  questionId,
  variant = 'ghost',
  size = 'sm',
  label,
  className,
}: StudentQuestionReportButtonProps) {
  return (
    <QuestionReportDialog
      questionId={questionId}
      triggerVariant={variant}
      triggerSize={size}
      triggerLabel={label}
      className={className}
    />
  )
}
