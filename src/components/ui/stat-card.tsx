import type { LucideIcon } from 'lucide-react'

import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

type StatCardTone =
  | 'default'
  | 'brand'
  | 'gold'
  | 'success'
  | 'warning'
  | 'plum'
  | 'coral'
  | 'aqua'

const iconToneClasses: Record<StatCardTone, string> = {
  default: 'bg-muted text-muted-foreground',
  brand: 'bg-brand-soft text-brand',
  gold: 'bg-gold-soft text-gold-foreground',
  success: 'bg-success-soft text-success-foreground',
  warning: 'bg-warning-soft text-warning-foreground',
  plum: 'bg-plum-soft text-plum-foreground',
  coral: 'bg-coral-soft text-coral-foreground',
  aqua: 'bg-aqua-soft text-aqua-foreground',
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
    <Card className={cn('transition-shadow hover:shadow-lg', className)}>
      <CardContent className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1.5">
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            {label}
          </p>
          <p className="text-[2rem] font-semibold leading-none tracking-tight text-foreground">{value}</p>
          {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
        </div>
        {Icon ? (
          <span
            className={cn(
              'inline-flex size-10 shrink-0 items-center justify-center rounded-2xl',
              iconToneClasses[tone]
            )}
          >
            <Icon className="size-[1.15rem]" />
          </span>
        ) : null}
      </CardContent>
    </Card>
  )
}
