'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { MockExamInstructions } from '@/components/student/mock-exams/mock-exam-instructions'
import { MockExamTypeCard } from '@/components/student/mock-exams/mock-exam-type-card'
import { formatDuration } from '@/components/student/mock-exams/utils'
import {
  prepareMockExamAction,
  startMockExamAction,
} from '@/app/student/mock-exams/actions'
import { MOCK_EXAM_CONFIG_LIST, type MockExamTypeConfig } from '@/lib/mock-exams/config'
import type { MockExamSummaryRow, PrepareMockExamResult } from '@/lib/mock-exams/types'
import { EXAM_TYPES, type ExamType, type SubjectRecord } from '@/lib/types'
import { cn } from '@/lib/utils'

interface MockExamLandingProps {
  subjects: SubjectRecord[]
  recentExams: MockExamSummaryRow[]
  defaultExamType: ExamType
}

function statusBadgeVariant(status: MockExamSummaryRow['status']) {
  if (status === 'submitted') {
    return 'secondary' as const
  }
  if (status === 'in_progress') {
    return 'default' as const
  }
  return 'outline' as const
}

function statusLabel(status: MockExamSummaryRow['status']): string {
  if (status === 'in_progress') {
    return 'In progress'
  }
  if (status === 'submitted') {
    return 'Completed'
  }
  return 'Expired'
}

export function MockExamLanding({ subjects, recentExams, defaultExamType }: MockExamLandingProps) {
  const router = useRouter()
  const [examType, setExamType] = useState<ExamType>(defaultExamType)
  const [subjectId, setSubjectId] = useState('')
  const [prepared, setPrepared] = useState<PrepareMockExamResult | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [preparingType, setPreparingType] = useState<string | null>(null)
  const [isPreparing, startPreparing] = useTransition()
  const [isBeginning, startBeginning] = useTransition()

  function handleStart(config: MockExamTypeConfig) {
    setPreparingType(config.type)
    startPreparing(async () => {
      const result = await prepareMockExamAction(
        config.type,
        examType,
        config.requiresSubject ? subjectId : null
      )
      setPreparingType(null)

      if (!result.success || !result.data) {
        toast.error(result.message ?? 'Unable to prepare this mock exam.')
        return
      }

      setPrepared(result.data)
      setDialogOpen(true)
    })
  }

  function handleBegin() {
    if (!prepared) {
      return
    }

    startBeginning(async () => {
      const result = await startMockExamAction(
        prepared.mockType,
        prepared.examType,
        prepared.subjectId
      )

      if (!result.success || !result.data) {
        toast.error(result.message ?? 'Unable to start this mock exam.')
        return
      }

      setDialogOpen(false)
      router.push(`/student/mock-exams/${result.data.sessionId}`)
    })
  }

  const canBegin = Boolean(prepared && prepared.availableQuestionCount > 0)

  return (
    <div className="space-y-6">
      <Card className="rounded-2xl shadow-sm ring-border">
        <CardHeader className="border-b border-border/70">
          <CardTitle>Choose your exam</CardTitle>
          <CardDescription>
            Mini and Subject mocks follow the exam type you pick here. Full mocks are fixed to their
            own test.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Exam type
            </span>
            <div className="inline-flex rounded-lg border border-border bg-muted p-1">
              {EXAM_TYPES.map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setExamType(value)}
                  className={cn(
                    'rounded-md px-4 py-1.5 text-sm font-medium transition-colors',
                    examType === value
                      ? 'bg-card text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  {value}
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {MOCK_EXAM_CONFIG_LIST.map((config) => (
          <MockExamTypeCard
            key={config.type}
            config={config}
            examType={examType}
            subjects={subjects}
            subjectId={subjectId}
            onSubjectChange={setSubjectId}
            onStart={() => handleStart(config)}
            isPending={isPreparing && preparingType === config.type}
          />
        ))}
      </div>

      {recentExams.length > 0 ? (
        <Card className="rounded-2xl shadow-sm ring-border">
          <CardHeader className="border-b border-border/70">
            <CardTitle>Recent mock exams</CardTitle>
            <CardDescription>Resume an exam in progress or review a completed one.</CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            <ul className="divide-y divide-border/70">
              {recentExams.map((exam) => {
                const href =
                  exam.status === 'in_progress'
                    ? `/student/mock-exams/${exam.id}`
                    : `/student/mock-exams/${exam.id}/results`
                return (
                  <li
                    key={exam.id}
                    className="flex flex-wrap items-center justify-between gap-3 py-3"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium text-foreground">{exam.mockName}</p>
                        <Badge variant={statusBadgeVariant(exam.status)}>
                          {statusLabel(exam.status)}
                        </Badge>
                        <Badge variant="outline">{exam.examType}</Badge>
                        {exam.subjectName ? (
                          <Badge variant="outline">{exam.subjectName}</Badge>
                        ) : null}
                      </div>
                      {exam.status === 'submitted' ? (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {exam.correctCount}/{exam.totalQuestions} correct ·{' '}
                          {exam.accuracy ?? 0}% · {formatDuration(exam.totalTimeSeconds)}
                        </p>
                      ) : (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {exam.totalQuestions} question{exam.totalQuestions === 1 ? '' : 's'}
                        </p>
                      )}
                    </div>
                    <Link
                      href={href}
                      className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
                    >
                      {exam.status === 'in_progress' ? 'Resume' : 'View results'}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{prepared?.mockName ?? 'Mock exam'}</DialogTitle>
            <DialogDescription>Read the rules, then begin when you are ready.</DialogDescription>
          </DialogHeader>
          {prepared ? <MockExamInstructions prepared={prepared} /> : null}
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
            <Button onClick={handleBegin} disabled={!canBegin || isBeginning}>
              {isBeginning ? 'Starting…' : 'Begin exam'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
