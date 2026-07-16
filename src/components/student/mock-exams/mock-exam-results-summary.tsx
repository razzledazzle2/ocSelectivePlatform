import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatDuration } from '@/components/student/mock-exams/utils'
import type { MockExamResults } from '@/lib/mock-exams/types'

interface MockExamResultsSummaryProps {
  results: MockExamResults
}

interface Metric {
  label: string
  value: string
  hint?: string
}

export function MockExamResultsSummary({ results }: MockExamResultsSummaryProps) {
  const { session } = results
  const accuracy = session.accuracy ?? 0

  const metrics: Metric[] = [
    {
      label: 'Score',
      value: `${session.correctCount}/${session.totalQuestions}`,
      hint: 'Correct answers',
    },
    { label: 'Accuracy', value: `${accuracy}%` },
    { label: 'Incorrect', value: String(session.incorrectCount) },
    { label: 'Unanswered', value: String(session.unansweredCount) },
    { label: 'Time taken', value: formatDuration(session.totalTimeSeconds) },
    {
      label: 'Avg / question',
      value: formatDuration(results.averageTimeSeconds),
      hint: 'Answered questions',
    },
    { label: 'Flagged', value: String(results.flaggedCount) },
    { label: 'Questions', value: String(session.totalQuestions) },
  ]

  return (
    <Card className="rounded-2xl border border-border shadow-card">
      <CardHeader className="border-b border-border/70">
        <CardTitle>Overall result</CardTitle>
      </CardHeader>
      <CardContent className="pt-6">
        <div className="mb-6 flex flex-col items-center justify-center gap-1 rounded-2xl border border-border bg-muted/50 py-6">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Accuracy</p>
          <p className="text-5xl font-semibold text-foreground">{accuracy}%</p>
          <p className="text-sm text-muted-foreground">
            {session.correctCount} of {session.totalQuestions} correct
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {metrics.map((metric) => (
            <div key={metric.label} className="rounded-2xl border border-border bg-white px-4 py-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">{metric.label}</p>
              <p className="mt-1 text-2xl font-semibold text-foreground">{metric.value}</p>
              {metric.hint ? (
                <p className="mt-0.5 text-[11px] text-muted-foreground">{metric.hint}</p>
              ) : null}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
