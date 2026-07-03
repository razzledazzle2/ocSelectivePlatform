import Link from 'next/link'
import { HourglassIcon, PenLineIcon, RotateCcwIcon, TimerIcon, UsersIcon } from 'lucide-react'

import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { MockExamBreakdownTable } from '@/components/student/mock-exams/mock-exam-breakdown-table'
import { MockExamIncorrectReview } from '@/components/student/mock-exams/mock-exam-incorrect-review'
import { MockExamRecommendationCard } from '@/components/student/mock-exams/mock-exam-recommendation-card'
import { MockExamResultsSummary } from '@/components/student/mock-exams/mock-exam-results-summary'
import type { MockExamResults } from '@/lib/mock-exams/types'
import { cn } from '@/lib/utils'

interface MockExamResultsViewProps {
  results: MockExamResults
}

function ComparisonCard({ results }: { results: MockExamResults }) {
  const comparison = results.comparison
  const accuracy = results.session.accuracy ?? 0

  return (
    <Card className="rounded-2xl shadow-sm ring-border">
      <CardHeader className="border-b border-border/70">
        <CardTitle className="flex items-center gap-2 text-base">
          <UsersIcon className="size-4 text-brand" />
          How you compare
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-5">
        {comparison ? (
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-border bg-muted/50 px-4 py-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Your score</p>
              <p className="mt-1 text-2xl font-semibold text-foreground">{accuracy}%</p>
            </div>
            <div className="rounded-2xl border border-border bg-muted/50 px-4 py-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Mock average</p>
              <p className="mt-1 text-2xl font-semibold text-foreground">
                {comparison.averageAccuracy}%
              </p>
            </div>
            <div className="rounded-2xl border border-border bg-muted/50 px-4 py-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Rank</p>
              <p className="mt-1 text-2xl font-semibold text-foreground">
                {comparison.rank} <span className="text-base text-muted-foreground">/ {comparison.participantCount}</span>
              </p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Comparison data will appear once more students complete this mock.
          </p>
        )}
      </CardContent>
    </Card>
  )
}

function formatSpentTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60)
  const rest = seconds % 60
  return minutes > 0 ? `${minutes}m ${rest}s` : `${rest}s`
}

function MostTimeSpent({ results }: { results: MockExamResults }) {
  const slowest = [...results.reviewQuestions]
    .filter((question) => (question.timeSpentSeconds ?? 0) > 0)
    .sort((a, b) => (b.timeSpentSeconds ?? 0) - (a.timeSpentSeconds ?? 0))[0]

  if (!slowest) {
    return null
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3.5 shadow-sm">
      <span className="flex size-8 items-center justify-center rounded-lg bg-brand-soft text-brand">
        <HourglassIcon className="size-4" />
      </span>
      <p className="text-sm text-foreground/80">
        Most time spent:{' '}
        <span className="font-medium text-foreground">
          {slowest.subjectName} Q{slowest.questionOrder}
        </span>{' '}
        ({formatSpentTime(slowest.timeSpentSeconds ?? 0)})
        {!slowest.isCorrect ? ' — worth reviewing below.' : '.'}
      </p>
    </div>
  )
}

function WritingStatusCard({ results }: { results: MockExamResults }) {
  const writing = results.writingSection

  if (!writing) {
    return null
  }

  return (
    <Card className="rounded-2xl shadow-sm ring-border">
      <CardHeader className="border-b border-border/70">
        <CardTitle className="flex items-center gap-2 text-base">
          <PenLineIcon className="size-4 text-brand" />
          Writing
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 pt-5">
        <p className="text-sm text-muted-foreground">
          {writing.submittedForMarking
            ? 'Your writing was submitted for marking. Writing is marked by a tutor and does not count towards the auto-marked score above.'
            : 'You chose to finish your writing later. It is saved as a draft and has not been submitted for marking.'}
        </p>
        {writing.response ? (
          <div className="max-h-64 overflow-y-auto whitespace-pre-wrap rounded-2xl border border-border bg-muted/50 px-4 py-4 text-sm leading-7 text-foreground/80">
            {writing.response}
          </div>
        ) : (
          <p className="text-sm italic text-muted-foreground">No writing was entered.</p>
        )}
      </CardContent>
    </Card>
  )
}

export function MockExamResultsView({ results }: MockExamResultsViewProps) {
  return (
    <div className="space-y-6">
      <MockExamResultsSummary results={results} />

      <ComparisonCard results={results} />
      <MostTimeSpent results={results} />

      <div className="flex flex-wrap gap-3">
        <Link href="/student/mock-exams" className={cn(buttonVariants())}>
          <TimerIcon className="size-4" />
          New mock exam
        </Link>
        <Link
          href="/student/revision"
          className={cn(buttonVariants({ variant: 'outline' }))}
        >
          <RotateCcwIcon className="size-4" />
          Revise mistakes
        </Link>
        <Link
          href="/student/practice"
          className={cn(buttonVariants({ variant: 'outline' }))}
        >
          Practise weak areas
        </Link>
      </div>

      <MockExamRecommendationCard recommendations={results.recommendations} />

      <Card className="rounded-2xl shadow-sm ring-border">
        <CardHeader className="border-b border-border/70">
          <CardTitle>Performance breakdown</CardTitle>
        </CardHeader>
        <CardContent className="pt-5">
          <Tabs defaultValue="subject">
            <TabsList>
              <TabsTrigger value="subject">By subject</TabsTrigger>
              <TabsTrigger value="topic">By topic</TabsTrigger>
              <TabsTrigger value="type">By question type</TabsTrigger>
            </TabsList>
            <TabsContent value="subject" className="pt-3">
              <MockExamBreakdownTable
                rows={results.subjectBreakdown}
                labelHeading="Subject"
                emptyMessage="No subject data for this exam."
              />
            </TabsContent>
            <TabsContent value="topic" className="pt-3">
              <MockExamBreakdownTable
                rows={results.topicBreakdown}
                labelHeading="Topic"
                emptyMessage="No topic data for this exam."
              />
            </TabsContent>
            <TabsContent value="type" className="pt-3">
              <MockExamBreakdownTable
                rows={results.questionTypeBreakdown}
                labelHeading="Question type"
                emptyMessage="These questions were not tagged with a question type."
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <WritingStatusCard results={results} />

      <MockExamIncorrectReview questions={results.reviewQuestions} />
    </div>
  )
}
