import Link from 'next/link'
import { ArrowRightIcon } from 'lucide-react'

import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { TodaysPlanAction } from '@/lib/dashboard/analysis'
import { cn } from '@/lib/utils'

interface TodaysPlanCardProps {
  actions: TodaysPlanAction[]
}

/**
 * The Dashboard's single "what should I do next" section — up to 3 concrete
 * actions, the first carrying the strongest visual emphasis since it is the
 * primary recommended action.
 */
export function TodaysPlanCard({ actions }: TodaysPlanCardProps) {
  if (actions.length === 0) {
    return null
  }

  return (
    <Card className="rounded-2xl border border-border shadow-card">
      <CardHeader>
        <CardTitle>Today&apos;s plan</CardTitle>
        <CardDescription>Your highest-value next steps, in order.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {actions.map((action, index) => (
          <Link
            key={action.id}
            href={action.href}
            className={cn(
              'flex items-center justify-between gap-4 rounded-xl border px-4 py-3.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand',
              index === 0
                ? 'border-brand/30 bg-brand-soft hover:bg-brand-soft/70'
                : 'border-border bg-card hover:bg-muted/50'
            )}
          >
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">{action.title}</p>
              <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{action.description}</p>
            </div>
            <span
              className={cn(
                buttonVariants({ size: 'sm', variant: index === 0 ? 'default' : 'outline' }),
                'pointer-events-none shrink-0'
              )}
            >
              {action.ctaLabel}
              <ArrowRightIcon className="size-3.5" />
            </span>
          </Link>
        ))}
      </CardContent>
    </Card>
  )
}
