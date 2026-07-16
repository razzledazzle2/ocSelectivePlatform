import { AlertTriangleIcon, InfoIcon, OctagonAlertIcon } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { CoverageBucket, CoverageWarning, MockCoverage } from '@/lib/mock-tests/types'
import { cn } from '@/lib/utils'

const WARNING_ICON = {
  critical: OctagonAlertIcon,
  warning: AlertTriangleIcon,
  info: InfoIcon,
} as const

const WARNING_STYLES = {
  critical: 'border-destructive/40 bg-destructive/5 text-foreground',
  warning: 'border-warning/40 bg-warning-soft text-foreground',
  info: 'border-border bg-muted/40 text-muted-foreground',
} as const

const WARNING_ICON_COLOR = {
  critical: 'text-destructive',
  warning: 'text-warning',
  info: 'text-muted-foreground',
} as const

function DistributionList({
  title,
  buckets,
  total,
  emptyLabel,
}: {
  title: string
  buckets: CoverageBucket[]
  total: number
  emptyLabel?: string
}) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</p>
      {buckets.length === 0 ? (
        <p className="text-sm text-muted-foreground">{emptyLabel ?? 'None'}</p>
      ) : (
        <ul className="space-y-1.5">
          {buckets.map((bucket) => {
            const pct = total > 0 ? Math.round((bucket.count / total) * 100) : 0
            return (
              <li key={bucket.key} className="space-y-1">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="min-w-0 truncate text-foreground">{bucket.label}</span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">
                    {bucket.count} · {pct}%
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-brand" style={{ width: `${pct}%` }} />
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

function CoverageWarnings({ warnings }: { warnings: CoverageWarning[] }) {
  if (warnings.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-success/40 bg-success-soft px-4 py-3 text-sm text-foreground">
        <InfoIcon className="size-4 shrink-0 text-success" />
        No composition warnings — this looks balanced.
      </div>
    )
  }
  return (
    <div className="space-y-2">
      {warnings.map((warning, index) => {
        const Icon = WARNING_ICON[warning.tone]
        return (
          <div
            key={index}
            className={cn('flex items-start gap-2.5 rounded-xl border px-4 py-3 text-sm', WARNING_STYLES[warning.tone])}
          >
            <Icon className={cn('mt-0.5 size-4 shrink-0', WARNING_ICON_COLOR[warning.tone])} />
            <p>{warning.message}</p>
          </div>
        )
      })}
    </div>
  )
}

export function MockCoveragePanel({ coverage }: { coverage: MockCoverage }) {
  const { totalQuestions } = coverage

  return (
    <div className="space-y-6">
      {/* Summary tiles */}
      <div className="grid gap-3 sm:grid-cols-4">
        {[
          { label: 'Questions', value: coverage.totalQuestions },
          { label: 'Total marks', value: coverage.totalMarks },
          { label: 'With diagrams', value: coverage.assetCount },
          { label: 'Writing tasks', value: coverage.writingCount },
        ].map((tile) => (
          <div key={tile.label} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{tile.label}</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">{tile.value}</p>
          </div>
        ))}
      </div>

      <Card className="rounded-2xl border border-border shadow-card">
        <CardHeader className="border-b border-border/70">
          <CardTitle>Coverage warnings</CardTitle>
          <CardDescription>
            Signals to check before publishing — none of these block a publish on their own.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          <CoverageWarnings warnings={coverage.warnings} />
        </CardContent>
      </Card>

      <Card className="rounded-2xl border border-border shadow-card">
        <CardHeader className="border-b border-border/70">
          <CardTitle>Distribution</CardTitle>
          <CardDescription>How the {totalQuestions} questions spread across the bank taxonomy.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 pt-5 sm:grid-cols-2">
          <DistributionList title="Subject" buckets={coverage.bySubject} total={totalQuestions} />
          <DistributionList title="Difficulty" buckets={coverage.byDifficulty} total={totalQuestions} />
          <DistributionList title="Topic" buckets={coverage.byTopic} total={totalQuestions} />
          <DistributionList
            title="Essential question type"
            buckets={coverage.byQuestionType}
            total={totalQuestions}
          />
          <DistributionList title="Answer format" buckets={coverage.byAnswerFormat} total={totalQuestions} />
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Skill tags</p>
            {coverage.bySkillTag.length === 0 ? (
              <p className="text-sm text-muted-foreground">No skill tags on these questions.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {coverage.bySkillTag.map((bucket) => (
                  <Badge key={bucket.key} variant="outline">
                    {bucket.label} · {bucket.count}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
