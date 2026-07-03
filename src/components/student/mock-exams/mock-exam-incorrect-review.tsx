import { CheckCircle2Icon, FlagIcon } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import type { MockExamReviewQuestion } from '@/lib/mock-exams/types'

interface MockExamIncorrectReviewProps {
  questions: MockExamReviewQuestion[]
}

export function MockExamIncorrectReview({ questions }: MockExamIncorrectReviewProps) {
  const missed = questions.filter((question) => !question.isCorrect)

  if (!missed.length) {
    return (
      <Card className="rounded-2xl shadow-sm ring-border">
        <CardContent className="flex items-center gap-3 py-6">
          <CheckCircle2Icon className="size-5 text-emerald-600" />
          <div>
            <p className="text-sm font-semibold text-foreground">Perfect paper!</p>
            <p className="text-sm text-muted-foreground">
              You answered every question correctly. Nothing to review here.
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="rounded-2xl shadow-sm ring-border">
      <CardHeader className="border-b border-border/70">
        <CardTitle>Review incorrect questions</CardTitle>
        <CardDescription>
          These {missed.length} question{missed.length === 1 ? '' : 's'} went into your Smart
          Revision queue. Compare your answer with the worked solution.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 pt-6">
        {missed.map((question) => {
          const optionLookup = new Map(question.options.map((option) => [option.label, option.option_text]))
          const selectedText = question.selectedOptionLabel
            ? optionLookup.get(question.selectedOptionLabel)
            : null
          const correctText = optionLookup.get(question.correctOptionLabel)

          return (
            <div
              key={question.questionId}
              className="rounded-2xl border border-border bg-muted/50 px-4 py-4"
            >
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Q{question.questionOrder}
                </span>
                <Badge variant="secondary">{question.subjectName}</Badge>
                <Badge variant="outline">{question.topicName}</Badge>
                {question.isFlagged ? (
                  <Badge variant="outline" className="gap-1 text-amber-700">
                    <FlagIcon className="size-3 fill-amber-400 text-amber-500" />
                    Flagged
                  </Badge>
                ) : null}
              </div>

              {question.passageText ? (
                <p className="mb-2 rounded-xl border border-border bg-white px-3 py-2 text-sm leading-6 text-foreground/80">
                  {question.passageText}
                </p>
              ) : null}
              <p className="text-sm font-medium leading-7 text-foreground">{question.questionText}</p>

              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <div
                  className={cn(
                    'rounded-xl border px-3 py-2 text-sm',
                    'border-red-200 bg-red-50 text-red-900'
                  )}
                >
                  <p className="text-xs font-semibold uppercase tracking-wide text-red-700">
                    Your answer
                  </p>
                  <p className="mt-0.5 leading-6">
                    {question.isAnswered
                      ? `${question.selectedOptionLabel}. ${selectedText ?? ''}`
                      : 'Not answered'}
                  </p>
                </div>
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
                  <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                    Correct answer
                  </p>
                  <p className="mt-0.5 leading-6">
                    {question.correctOptionLabel}. {correctText ?? ''}
                  </p>
                </div>
              </div>

              <Separator className="my-3" />

              {question.shortExplanation ? (
                <div className="mb-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Explanation
                  </p>
                  <p className="mt-0.5 text-sm leading-7 text-foreground/80">
                    {question.shortExplanation}
                  </p>
                </div>
              ) : null}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Worked solution
                </p>
                <p className="mt-0.5 text-sm leading-7 text-foreground/80">{question.workedSolution}</p>
              </div>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
