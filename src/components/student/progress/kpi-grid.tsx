import { BookCheckIcon, LayersIcon, TargetIcon, TrendingUpIcon } from 'lucide-react'

import { StatCard } from '@/components/ui/stat-card'
import type { ProgressPeriodComparison, ProgressRange, StudentProgressData } from '@/lib/types'

interface ProgressKpiGridProps {
  metrics: StudentProgressData['metrics']
  comparison: ProgressPeriodComparison
  range: ProgressRange
}

function questionsHint(delta: number | null, range: ProgressRange): string {
  if (delta === null || range === 'all') return 'In the selected period'
  if (delta === 0) return 'Same as the previous period'
  const direction = delta > 0 ? 'more' : 'fewer'
  return `${Math.abs(delta)} ${direction} than the previous period`
}

function accuracyHint(delta: number | null, range: ProgressRange): string {
  if (delta === null || range === 'all') return 'Across the selected period'
  if (delta === 0) return 'Unchanged from the previous period'
  const direction = delta > 0 ? 'up' : 'down'
  return `${direction} ${Math.abs(delta)}pp vs the previous period`
}

export function ProgressKpiGrid({ metrics, comparison, range }: ProgressKpiGridProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard
        label="Questions completed"
        value={String(metrics.questionsCompleted)}
        hint={questionsHint(comparison.questionsDelta, range)}
        icon={BookCheckIcon}
        tone="brand"
      />
      <StatCard
        label="Overall accuracy"
        value={metrics.overallAccuracy === null ? '—' : `${metrics.overallAccuracy}%`}
        hint={accuracyHint(comparison.accuracyDelta, range)}
        icon={TargetIcon}
        tone="success"
      />
      <StatCard
        label="Active days"
        value={String(metrics.activeDays)}
        hint="Days with meaningful practice"
        icon={TrendingUpIcon}
        tone="gold"
      />
      <StatCard
        label="Skills mastered"
        value={String(metrics.skillsMastered)}
        hint="Across Maths & Thinking Skills"
        icon={LayersIcon}
        tone="warning"
      />
    </div>
  )
}
