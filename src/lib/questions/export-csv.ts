import type { AdminQuestionListItem } from '@/lib/types'

function escapeCsvCell(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
}

/** Client-side CSV download of question-bank rows (same columns as the old table export). */
export function exportQuestionsCsv(rows: AdminQuestionListItem[]) {
  const headers = [
    'id',
    'question_preview',
    'subject',
    'topic',
    'question_type',
    'exam_type',
    'difficulty',
    'options_count',
    'correct_answer',
    'tags',
    'status',
    'updated_at',
  ]
  const lines = [
    headers.join(','),
    ...rows.map((row) =>
      [
        row.id,
        row.questionTextPreview,
        row.subjectName,
        row.topicName,
        row.questionTypeName ?? '',
        row.examType,
        String(row.difficulty),
        String(row.optionsCount),
        row.correctOptionLabel ?? '',
        row.tags.join(', '),
        row.status,
        row.updatedAt,
      ]
        .map(escapeCsvCell)
        .join(',')
    ),
  ]
  const blob = new Blob([`${lines.join('\n')}\n`], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `question-bank-export-${new Date().toISOString().slice(0, 10)}.csv`
  anchor.click()
  URL.revokeObjectURL(url)
}
