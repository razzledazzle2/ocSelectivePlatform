import type { LucideIcon } from 'lucide-react'

import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

type StatCardTone = 'default' | 'brand' | 'gold' | 'success' | 'warning'

const iconToneClasses: Record<StatCardTone, string> = {
  default: 'bg-muted text-muted-foreground',
  brand: 'bg-brand-soft text-brand',
  gold: 'bg-gold-soft text-gold-foreground',
  success: 'bg-success-soft text-success',
  warning: 'bg-warning-soft text-warning',
}

interface StatCardProps {
  label: string
  value: string
  hint?: string
  icon?: LucideIcon
  tone?: StatCardTone
  className?: string
}

/** Compact metric card: label, big value, optional hint and tinted icon chip. */
export function StatCard({ label, value, hint, icon: Icon, tone = 'brand', className }: StatCardProps) {
  return (
    <Card className={cn('rounded-2xl shadow-sm ring-border', className)}>
      <CardContent className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="text-3xl font-semibold tracking-tight text-foreground">{value}</p>
          {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
        </div>
        {Icon ? (
          <span
            className={cn(
              'inline-flex size-9 shrink-0 items-center justify-center rounded-xl',
              iconToneClasses[tone]
            )}
          >
            <Icon className="size-4" />
          </span>
        ) : null}
      </CardContent>
    </Card>
  )
}
