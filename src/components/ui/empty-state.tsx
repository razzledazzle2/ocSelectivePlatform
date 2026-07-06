import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface EmptyStateProps {
  icon?: LucideIcon
  title: string
  description?: ReactNode
  /** Usually a Button or a styled Link. */
  action?: ReactNode
  className?: string
}

/** Friendly dashed placeholder used when a list or view has no data yet. */
export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <Card className={cn('rounded-2xl border-dashed shadow-none ring-0 border border-border', className)}>
      <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
        {Icon ? (
          <span className="flex size-12 items-center justify-center rounded-2xl bg-brand-soft text-brand">
            <Icon className="size-5" />
          </span>
        ) : null}
        <div className="max-w-md space-y-1">
          <h3 className="text-base font-semibold text-foreground">{title}</h3>
          {description ? <p className="text-sm leading-6 text-muted-foreground">{description}</p> : null}
        </div>
        {action}
      </CardContent>
    </Card>
  )
}
