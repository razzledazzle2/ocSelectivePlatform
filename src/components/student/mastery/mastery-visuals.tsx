import {
  CircleCheckIcon,
  CircleDashedIcon,
  RotateCcwIcon,
  SproutIcon,
  TrendingUpIcon,
  TrophyIcon,
  type LucideIcon,
} from 'lucide-react'

import { cn } from '@/lib/utils'
import { MASTERY_STATE_META, type MasteryState } from '@/lib/mastery/core'
import type { AccuracyTrendPoint } from '@/lib/mastery/types'

/** Icon + tone per mastery state. The text label is ALWAYS shown — never colour alone. */
const STATE_STYLE: Record<MasteryState, { Icon: LucideIcon; className: string; bar: string }> = {
  not_started: { Icon: CircleDashedIcon, className: 'bg-muted text-muted-foreground', bar: 'bg-muted-foreground/30' },
  learning: { Icon: SproutIcon, className: 'bg-brand-soft text-brand', bar: 'bg-brand' },
  developing: { Icon: TrendingUpIcon, className: 'bg-warning-soft text-warning', bar: 'bg-warning' },
  proficient: { Icon: CircleCheckIcon, className: 'bg-gold-soft text-gold-foreground', bar: 'bg-gold' },
  mastered: { Icon: TrophyIcon, className: 'bg-success-soft text-success', bar: 'bg-success' },
  needs_review: { Icon: RotateCcwIcon, className: 'bg-warning-soft text-warning', bar: 'bg-warning' },
}

export function masteryBarClass(state: MasteryState): string {
  return STATE_STYLE[state].bar
}

export function MasteryStateBadge({
  state,
  className,
  size = 'default',
}: {
  state: MasteryState
  className?: string
  size?: 'default' | 'sm'
}) {
  const { Icon, className: tone } = STATE_STYLE[state]
  const { label, description } = MASTERY_STATE_META[state]
  return (
    <span
      className={cn(
        'inline-flex w-fit items-center gap-1.5 rounded-full font-medium',
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm',
        tone,
        className
      )}
      title={description}
    >
      <Icon className={size === 'sm' ? 'size-3.5' : 'size-4'} aria-hidden />
      <span>{label}</span>
    </span>
  )
}

/** Thin mastery bar. An unscored subtopic shows an empty track, never a fake 0%. */
export function MasteryBar({
  percent,
  state,
  className,
}: {
  percent: number | null
  state: MasteryState
  className?: string
}) {
  return (
    <div className={cn('h-1.5 w-full overflow-hidden rounded-full bg-muted', className)} aria-hidden>
      {percent === null ? null : (
        <div
          className={cn('h-full rounded-full transition-all', masteryBarClass(state))}
          style={{ width: `${Math.max(2, percent)}%` }}
        />
      )}
    </div>
  )
}

/**
 * Rolling-accuracy sparkline. Deliberately simple: a polyline over the student's
 * attempt history in this subtopic, with a 50% guide line.
 */
export function AccuracyTrendChart({ points, className }: { points: AccuracyTrendPoint[]; className?: string }) {
  if (points.length < 2) {
    return (
      <p className={cn('text-sm text-muted-foreground', className)}>
        Answer a few more questions here and your accuracy trend will appear.
      </p>
    )
  }

  const width = 100
  const height = 32
  const step = width / (points.length - 1)
  const path = points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${(index * step).toFixed(2)} ${(height - (point.accuracy / 100) * height).toFixed(2)}`)
    .join(' ')

  const last = points[points.length - 1]
  const first = points[0]
  const direction = last.accuracy - first.accuracy

  return (
    <div className={cn('space-y-2', className)}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        className="h-16 w-full"
        role="img"
        aria-label={`Accuracy trend: ${first.accuracy}% rising to ${last.accuracy}%`}
      >
        <line x1="0" y1={height / 2} x2={width} y2={height / 2} className="stroke-border" strokeWidth="0.5" strokeDasharray="2 2" />
        <path d={path} fill="none" className={direction >= 0 ? 'stroke-success' : 'stroke-warning'} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
      </svg>
      <p className="text-xs text-muted-foreground">
        Rolling accuracy over your {points.length} attempts here — most recent {last.accuracy}%.
      </p>
    </div>
  )
}
