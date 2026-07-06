import { QualitySignalBadge } from '@/components/admin/report-badges'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getAccuracy, getAverageTimeSeconds } from '@/lib/reports/quality-signals'
import type { QualitySignal, QuestionAttemptStats } from '@/lib/types'

interface QuestionQualitySummaryCardProps {
  stats: QuestionAttemptStats
  qualitySignals: QualitySignal[]
  openReportCount: number
  totalReportCount: number
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-muted/50 px-3 py-2.5">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold text-foreground">{value}</p>
    </div>
  )
}

/**
 * Compact quality snapshot for a single question, built only from real attempt
 * data and report counts. Shown inside the admin report detail dialog.
 */
export function QuestionQualitySummaryCard({
  stats,
  qualitySignals,
  openReportCount,
  totalReportCount,
}: QuestionQualitySummaryCardProps) {
  const accuracy = getAccuracy(stats)
  const averageTime = getAverageTimeSeconds(stats)

  return (
    <Card className="rounded-2xl ring-border">
      <CardHeader className="border-b border-border/70 pb-3">
        <CardTitle className="text-base">Quality snapshot</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 pt-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Metric label="Attempts" value={String(stats.totalAttempts)} />
          <Metric
            label="Accuracy"
            value={accuracy === null ? 'No data' : `${Math.round(accuracy * 100)}%`}
          />
          <Metric
            label="Avg time"
            value={averageTime === null ? 'No data' : `${Math.round(averageTime)}s`}
          />
          <Metric label="Reports" value={`${openReportCount} open / ${totalReportCount}`} />
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Quality signals
          </p>
          {qualitySignals.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No quality flags from the available data.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {qualitySignals.map((signal) => (
                <QualitySignalBadge key={signal.type} signal={signal} />
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
