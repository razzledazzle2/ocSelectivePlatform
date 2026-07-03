'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMemo, useState, useTransition } from 'react'
import { ArchiveIcon, DownloadIcon, PencilIcon, RocketIcon, RotateCcwIcon } from 'lucide-react'
import { toast } from 'sonner'

import {
  archiveQuestionAction,
  publishQuestionAction,
  unpublishQuestionAction,
} from '@/app/admin/questions/actions'
import { QuestionDuplicateActions } from '@/components/admin/question-duplicate-actions'
import { QuestionPreviewDialog } from '@/components/admin/question-preview-dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'
import type { ActionResult, AdminQuestionListItem } from '@/lib/types'

interface QuestionsTableProps {
  questions: AdminQuestionListItem[]
}

const dateFormatter = new Intl.DateTimeFormat('en-AU', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
})

function ArchiveQuestionDialog({ disabled, onConfirm }: { disabled: boolean; onConfirm: () => void }) {
  const [open, setOpen] = useState(false)

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger
        className={cn(buttonVariants({ variant: 'destructive', size: 'sm' }))}
        disabled={disabled}
      >
        <ArchiveIcon className="size-3.5" />
        Archive
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Archive this question?</AlertDialogTitle>
          <AlertDialogDescription>
            The question will be hidden from student practice, but it stays in the bank for later editing or
            restoration.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              onConfirm()
              setOpen(false)
            }}
          >
            Archive question
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

function getStatusVariant(status: AdminQuestionListItem['status']) {
  if (status === 'published') {
    return 'default'
  }

  if (status === 'archived') {
    return 'destructive'
  }

  return 'outline'
}

function escapeCsvCell(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
}

function exportQuestionsCsv(rows: AdminQuestionListItem[]) {
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
        row.correctOptionLabel,
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

export function QuestionsTable({ questions }: QuestionsTableProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const selectedQuestions = useMemo(
    () => questions.filter((question) => selectedIds.has(question.id)),
    [questions, selectedIds]
  )
  const allSelected = questions.length > 0 && selectedQuestions.length === questions.length

  function toggleAll() {
    setSelectedIds(allSelected ? new Set() : new Set(questions.map((question) => question.id)))
  }

  function toggleOne(id: string) {
    setSelectedIds((current) => {
      const next = new Set(current)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  function runAction(action: () => Promise<ActionResult>) {
    startTransition(async () => {
      const result = await action()

      if (result.success) {
        toast.success(result.message ?? 'Done.')
        router.refresh()
      } else {
        toast.error(result.message ?? 'Something went wrong.')
      }
    })
  }

  if (questions.length === 0) {
    return (
      <Card className="border-dashed border-slate-300 bg-white/80">
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          No questions match the current filters yet. Adjust the filters above, or import questions to get
          started.
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-white/70 bg-white/94 shadow-lg shadow-slate-200/50">
      <CardContent className="p-0">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 px-4 py-3">
          <p className="text-sm text-muted-foreground">
            {questions.length} question{questions.length === 1 ? '' : 's'}
            {selectedQuestions.length > 0 ? ` • ${selectedQuestions.length} selected` : ''}
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => exportQuestionsCsv(selectedQuestions.length > 0 ? selectedQuestions : questions)}
          >
            <DownloadIcon className="size-3.5" />
            {selectedQuestions.length > 0
              ? `Export ${selectedQuestions.length} selected`
              : 'Export all as CSV'}
          </Button>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <input
                    type="checkbox"
                    aria-label="Select all questions"
                    className="size-4 accent-slate-950"
                    checked={allSelected}
                    onChange={toggleAll}
                  />
                </TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[22rem]">Question</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead>Topic</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Exam</TableHead>
                <TableHead>Difficulty</TableHead>
                <TableHead className="text-center">Options</TableHead>
                <TableHead className="text-center">Correct</TableHead>
                <TableHead>Tags</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {questions.map((question) => (
                <TableRow key={question.id} data-state={selectedIds.has(question.id) ? 'selected' : undefined}>
                  <TableCell>
                    <input
                      type="checkbox"
                      aria-label={`Select question ${question.questionTextPreview.slice(0, 40)}`}
                      className="size-4 accent-slate-950"
                      checked={selectedIds.has(question.id)}
                      onChange={() => toggleOne(question.id)}
                    />
                  </TableCell>
                  <TableCell>
                    <Badge variant={getStatusVariant(question.status)}>{question.status}</Badge>
                  </TableCell>
                  <TableCell className="max-w-[22rem] whitespace-normal">
                    <div className="space-y-1">
                      <p className="font-medium text-slate-950">{question.questionTextPreview}</p>
                      <p className="text-xs text-muted-foreground">
                        Updated {dateFormatter.format(new Date(question.updatedAt))}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell>{question.subjectName}</TableCell>
                  <TableCell>{question.topicName}</TableCell>
                  <TableCell>{question.questionTypeName ?? 'Untagged'}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{question.examType}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">D{question.difficulty}</Badge>
                  </TableCell>
                  <TableCell className="text-center text-sm">{question.optionsCount}</TableCell>
                  <TableCell className="text-center">
                    <Badge variant="outline">{question.correctOptionLabel}</Badge>
                  </TableCell>
                  <TableCell className="max-w-[10rem]">
                    {question.tags.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {question.tags.slice(0, 3).map((tag) => (
                          <Badge key={tag} variant="outline" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                        {question.tags.length > 3 ? (
                          <span className="text-xs text-muted-foreground">+{question.tags.length - 3}</span>
                        ) : null}
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex flex-wrap justify-end gap-2">
                      <Link
                        href={`/admin/questions/${question.id}/edit`}
                        className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
                      >
                        <PencilIcon className="size-3.5" />
                        Edit
                      </Link>

                      <QuestionPreviewDialog questionId={question.id} />

                      {question.status === 'published' ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={isPending}
                          onClick={() => runAction(() => unpublishQuestionAction(question.id))}
                        >
                          <RotateCcwIcon className="size-3.5" />
                          Unpublish
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          size="sm"
                          disabled={isPending || question.status === 'archived'}
                          onClick={() => runAction(() => publishQuestionAction(question.id))}
                        >
                          <RocketIcon className="size-3.5" />
                          Publish
                        </Button>
                      )}

                      <ArchiveQuestionDialog
                        disabled={isPending || question.status === 'archived'}
                        onConfirm={() => runAction(() => archiveQuestionAction(question.id))}
                      />

                      <QuestionDuplicateActions questionId={question.id} />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}
