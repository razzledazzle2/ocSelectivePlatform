'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { ArchiveIcon, PencilIcon, RocketIcon, RotateCcwIcon } from 'lucide-react'
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

export function QuestionsTable({ questions }: QuestionsTableProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

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
          No questions match the current filters yet.
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-white/70 bg-white/94 shadow-lg shadow-slate-200/50">
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[26rem]">Question</TableHead>
              <TableHead>Subject</TableHead>
              <TableHead>Topic</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Exam</TableHead>
              <TableHead>Difficulty</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {questions.map((question) => (
              <TableRow key={question.id}>
                <TableCell className="max-w-[26rem] whitespace-normal">
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
                <TableCell>
                  <Badge variant={getStatusVariant(question.status)}>{question.status}</Badge>
                </TableCell>
                <TableCell>{dateFormatter.format(new Date(question.createdAt))}</TableCell>
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
      </CardContent>
    </Card>
  )
}
