'use client'

import { useEffect, useRef, useState } from 'react'
import { AlarmClockIcon } from 'lucide-react'

import { MOCK_EXAM_LOW_TIME_SECONDS } from '@/lib/mock-exams/config'
import { formatClock } from '@/components/student/mock-exams/utils'
import { cn } from '@/lib/utils'

interface MockExamTimerProps {
  /** Absolute deadline in epoch milliseconds (derived from the DB session, refresh-safe). */
  deadlineMs: number
  onExpire: () => void
}

function secondsLeft(deadlineMs: number): number {
  return Math.max(0, Math.round((deadlineMs - Date.now()) / 1000))
}

export function MockExamTimer({ deadlineMs, onExpire }: MockExamTimerProps) {
  const [remaining, setRemaining] = useState(() => secondsLeft(deadlineMs))
  const expiredRef = useRef(false)

  useEffect(() => {
    // Re-evaluate immediately in case the deadline is already past on mount (e.g. after a refresh).
    const tick = () => {
      const next = secondsLeft(deadlineMs)
      setRemaining(next)
      if (next <= 0 && !expiredRef.current) {
        expiredRef.current = true
        onExpire()
      }
    }

    tick()
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [deadlineMs, onExpire])

  const isLow = remaining <= MOCK_EXAM_LOW_TIME_SECONDS

  return (
    <div
      role="timer"
      aria-live={isLow ? 'assertive' : 'off'}
      className={cn(
        'inline-flex items-center gap-2 rounded-xl border px-3 py-1.5 font-mono text-base font-semibold tabular-nums transition-colors',
        isLow
          ? 'border-destructive/40 bg-destructive/10 text-destructive'
          : 'border-slate-200 bg-slate-50 text-slate-900'
      )}
    >
      <AlarmClockIcon className={cn('size-4', isLow && 'animate-pulse')} />
      {formatClock(remaining)}
    </div>
  )
}
