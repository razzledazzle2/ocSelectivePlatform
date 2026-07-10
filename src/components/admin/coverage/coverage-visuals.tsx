import {
  CircleCheckIcon,
  OctagonAlertIcon,
  ShieldCheckIcon,
  TriangleAlertIcon,
  type LucideIcon,
} from 'lucide-react'

import { cn } from '@/lib/utils'
import {
  COVERAGE_STATE_META,
  DIFFICULTY_BAND_LABELS,
  type CoverageState,
  type DifficultyBandCounts,
} from '@/lib/coverage/core'

/** Icon + tone per coverage state. Text label is ALWAYS shown — never colour alone. */
const STATE_STYLE: Record<CoverageState, { Icon: LucideIcon; className: string }> = {
  critical: { Icon: OctagonAlertIcon, className: 'bg-destructive/10 text-destructive' },
  limited: { Icon: TriangleAlertIcon, className: 'bg-warning-soft text-warning' },
  healthy: { Icon: CircleCheckIcon, className: 'bg-success-soft text-success' },
  strong: { Icon: ShieldCheckIcon, className: 'bg-brand-soft text-brand' },
}

export function CoverageStateBadge({
  state,
  className,
  size = 'default',
}: {
  state: CoverageState
  className?: string
  size?: 'default' | 'sm'
}) {
  const { Icon, className: tone } = STATE_STYLE[state]
  const { label } = COVERAGE_STATE_META[state]
  return (
    <span
      className={cn(
        'inline-flex w-fit items-center gap-1.5 rounded-full font-medium',
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm',
        tone,
        className
      )}
      title={COVERAGE_STATE_META[state].description}
    >
      <Icon className={size === 'sm' ? 'size-3.5' : 'size-4'} aria-hidden />
      <span>{label}</span>
    </span>
  )
}

/** Compact Easy / Medium / Hard distribution with a proportional bar and counts. */
export function DifficultyDistribution({
  counts,
  className,
}: {
  counts: DifficultyBandCounts
  className?: string
}) {
  const bands: Array<{ key: keyof DifficultyBandCounts; label: string; className: string }> = [
    { key: 'easy', label: DIFFICULTY_BAND_LABELS.easy, className: 'bg-success' },
    { key: 'medium', label: DIFFICULTY_BAND_LABELS.medium, className: 'bg-gold' },
    { key: 'hard', label: DIFFICULTY_BAND_LABELS.hard, className: 'bg-destructive' },
  ]
  const total = counts.easy + counts.medium + counts.hard + counts.unknown
  return (
    <div className={cn('space-y-1.5', className)}>
      <div className="flex h-2 w-full overflow-hidden rounded-full bg-muted" aria-hidden>
        {total > 0
          ? bands.map((b) => {
              const value = counts[b.key]
              if (value === 0) {
                return null
              }
              return (
                <span
                  key={b.key}
                  className={b.className}
                  style={{ width: `${(value / total) * 100}%` }}
                />
              )
            })
          : null}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
        {bands.map((b) => (
          <span key={b.key}>
            <span className="font-medium text-foreground">{counts[b.key]}</span> {b.label}
          </span>
        ))}
        {counts.unknown > 0 ? (
          <span>
            <span className="font-medium text-foreground">{counts.unknown}</span> Unbanded
          </span>
        ) : null}
      </div>
    </div>
  )
}
