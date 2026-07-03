import Link from 'next/link'
import { RotateCcwIcon, TimerIcon } from 'lucide-react'

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

export function MockExamResultsView({ results }: MockExamResultsViewProps) {
  return (
    <div className="space-y-6">
      <MockExamResultsSummary results={results} />

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

      <Card className="border-white/70 bg-white/94 shadow-lg shadow-slate-200/50">
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

      <MockExamIncorrectReview questions={results.reviewQuestions} />
    </div>
  )
}
