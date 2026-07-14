import Link from 'next/link'

import type { ProgressRange } from '@/lib/types'
import { cn } from '@/lib/utils'

interface RangeControlProps {
  active: ProgressRange
}

const RANGES: Array<{ value: ProgressRange; label: string }> = [
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
  { value: 'term', label: 'Current term' },
  { value: 'all', label: 'All time' },
]

export function RangeControl({ active }: RangeControlProps) {
  return (
    <nav aria-label="Date range" className="inline-flex gap-1 rounded-lg bg-muted p-1">
      {RANGES.map((range) => {
        const isActive = range.value === active
        return (
          <Link
            key={range.value}
            href={`/student/progress?range=${range.value}`}
            aria-current={isActive ? 'page' : undefined}
            className={cn(
              'rounded-md px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand',
              isActive ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {range.label}
          </Link>
        )
      })}
    </nav>
  )
}
