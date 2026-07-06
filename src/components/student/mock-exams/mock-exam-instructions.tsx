'use client'

import {
  AlarmClockIcon,
  BanIcon,
  FlagIcon,
  ListChecksIcon,
  MoveHorizontalIcon,
  RotateCcwIcon,
} from 'lucide-react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { formatTimeLimit } from '@/components/student/mock-exams/utils'
import type { PrepareMockExamResult } from '@/lib/mock-exams/types'

interface MockExamInstructionsProps {
  prepared: PrepareMockExamResult
}

const RULES = [
  { icon: BanIcon, text: 'No instant feedback — answers are marked only after you submit.' },
  { icon: MoveHorizontalIcon, text: 'Move freely between questions and change answers any time.' },
  { icon: FlagIcon, text: 'Flag tricky questions to revisit before submitting.' },
  { icon: ListChecksIcon, text: 'Detailed results and worked solutions appear after submission.' },
  { icon: RotateCcwIcon, text: 'Every question you miss is added to Smart Revision automatically.' },
  { icon: AlarmClockIcon, text: 'When the timer runs out, the exam submits itself.' },
]

export function MockExamInstructions({ prepared }: MockExamInstructionsProps) {
  const questionCount = Math.min(prepared.targetQuestionCount, prepared.availableQuestionCount)
  const isShort =
    prepared.availableQuestionCount > 0 &&
    prepared.availableQuestionCount < prepared.targetQuestionCount
  const isEmpty = prepared.availableQuestionCount === 0

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Badge>{prepared.examType}</Badge>
        {prepared.subjectName ? <Badge variant="secondary">{prepared.subjectName}</Badge> : null}
        <Badge variant="outline">{formatTimeLimit(prepared.timeLimitSeconds)}</Badge>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-border bg-muted/50 px-3 py-2.5">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Questions</p>
          <p className="mt-0.5 text-xl font-semibold text-foreground">{isEmpty ? 0 : questionCount}</p>
        </div>
        <div className="rounded-xl border border-border bg-muted/50 px-3 py-2.5">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Time limit</p>
          <p className="mt-0.5 text-xl font-semibold text-foreground">
            {formatTimeLimit(prepared.timeLimitSeconds)}
          </p>
        </div>
      </div>

      {isEmpty ? (
        <Alert variant="destructive">
          <BanIcon />
          <AlertTitle>Not enough questions yet</AlertTitle>
          <AlertDescription>
            There are no published questions for this exam configuration right now. Try a different
            exam type or subject.
          </AlertDescription>
        </Alert>
      ) : isShort ? (
        <Alert>
          <ListChecksIcon />
          <AlertTitle>Fewer questions available</AlertTitle>
          <AlertDescription>
            Only {prepared.availableQuestionCount} published question
            {prepared.availableQuestionCount === 1 ? '' : 's'} match this exam right now, so it will
            run with {questionCount} instead of {prepared.targetQuestionCount}.
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="space-y-2.5">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Exam rules
        </p>
        <ul className="space-y-2">
          {RULES.map((rule) => {
            const Icon = rule.icon
            return (
              <li key={rule.text} className="flex items-start gap-2.5 text-sm leading-6 text-foreground/80">
                <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <span>{rule.text}</span>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}
