'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { ArchiveIcon, EyeIcon, PencilIcon, RocketIcon, RotateCcwIcon } from 'lucide-react'

import {
  archiveQuestionAction,
  publishQuestionAction,
  unpublishQuestionAction,
} from '@/app/admin/questions/actions'
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
import { buttonVariants } from '@/components/ui/button'
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
import type { AdminQuestionListItem } from '@/lib/types'

interface AdminQuestionListProps {
  questions: AdminQuestionListItem[]
}

const dateFormatter = new Intl.DateTimeFormat('en-AU', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
})

function getStatusVariant(status: AdminQuestionListItem['status']) {
  if (status === 'published') {
    return 'default'
  }

  if (status === 'archived') {
    return 'destructive'
  }

  return 'outline'
}

export function AdminQuestionList({ questions }: AdminQuestionListProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [message, setMessage] = useState<string | null>(null)

  async function runAction(action: () => Promise<{ success: boolean; message?: string }>) {
    startTransition(async () => {
      const result = await action()
      setMessage(result.message ?? null)

      if (result.success) {
        router.refresh()
      }
    })
  }

  if (questions.length === 0) {
    return (
      <Card className="border-dashed border-slate-300 bg-white/80">
        <CardContent className="py-10 text-sm text-muted-foreground">
          No questions match the current filters yet.
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {message ? (
        <div className="rounded-2xl border border-slate-200 bg-white/85 px-4 py-3 text-sm text-slate-700">
          {message}
        </div>
      ) : null}

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
                      <p className="text-xs text-muted-foreground">Updated {dateFormatter.format(new Date(question.updatedAt))}</p>
                    </div>
                  </TableCell>
                  <TableCell>{question.subjectName}</TableCell>
                  <TableCell>{question.topicName}</TableCell>
                  <TableCell>{question.questionTypeName ?? 'Optional'}</TableCell>
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
                      <Link
                        href={`/admin/questions/${question.id}/preview`}
                        className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }))}
                      >
                        <EyeIcon className="size-3.5" />
                        Preview
                      </Link>
                      {question.status === 'published' ? (
                        <button
                          type="button"
                          className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
                          disabled={isPending}
                          onClick={() => void runAction(() => unpublishQuestionAction(question.id))}
                        >
                          <RotateCcwIcon className="size-3.5" />
                          Unpublish
                        </button>
                      ) : (
                        <button
                          type="button"
                          className={cn(buttonVariants({ variant: 'default', size: 'sm' }))}
                          disabled={isPending || question.status === 'archived'}
                          onClick={() => void runAction(() => publishQuestionAction(question.id))}
                        >
                          <RocketIcon className="size-3.5" />
                          Publish
                        </button>
                      )}
                      <AlertDialog>
                        <AlertDialogTrigger className={cn(buttonVariants({ variant: 'destructive', size: 'sm' }))}>
                          <ArchiveIcon className="size-3.5" />
                          Archive
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Archive this question?</AlertDialogTitle>
                            <AlertDialogDescription>
                              The question will be hidden from student practice, but it will stay in the bank for later editing or restoration.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              disabled={isPending}
                              onClick={() => void runAction(() => archiveQuestionAction(question.id))}
                            >
                              Archive question
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
