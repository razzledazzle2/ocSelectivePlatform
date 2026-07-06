'use client'

import { DownloadIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { exportQuestionsCsv } from '@/lib/questions/export-csv'
import type { AdminQuestionListItem } from '@/lib/types'

interface ExportQuestionsCsvButtonProps {
  questions: AdminQuestionListItem[]
}

/** Header action: download the currently filtered question list as CSV. */
export function ExportQuestionsCsvButton({ questions }: ExportQuestionsCsvButtonProps) {
  return (
    <Button
      type="button"
      variant="outline"
      disabled={questions.length === 0}
      onClick={() => exportQuestionsCsv(questions)}
    >
      <DownloadIcon className="size-4" />
      Export CSV
    </Button>
  )
}
