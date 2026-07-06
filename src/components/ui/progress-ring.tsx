import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

interface ProgressRingProps {
  /** 0–100. */
  value: number
  /** Diameter in px. */
  size?: number
  strokeWidth?: number
  /** Content rendered in the centre (e.g. "62%"). */
  children?: ReactNode
  className?: string
}

/** Simple SVG progress ring in the brand blue, used for overall-progress stats. */
export function ProgressRing({ value, size = 112, strokeWidth = 10, children, className }: ProgressRingProps) {
  const clamped = Math.max(0, Math.min(100, value))
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference * (1 - clamped / 100)

  return (
    <div
      className={cn('relative inline-flex items-center justify-center', className)}
      style={{ width: size, height: size }}
      role="img"
      aria-label={`${Math.round(clamped)}%`}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          className="stroke-brand-soft"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="stroke-brand transition-[stroke-dashoffset] duration-700"
        />
      </svg>
      {children ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>
      ) : null}
    </div>
  )
}
