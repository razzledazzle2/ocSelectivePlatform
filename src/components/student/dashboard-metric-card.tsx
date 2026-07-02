import type { LucideIcon } from 'lucide-react'

import { Card, CardContent } from '@/components/ui/card'

interface DashboardMetricCardProps {
  label: string
  value: string
  hint?: string
  icon?: LucideIcon
}

export function DashboardMetricCard({ label, value, hint, icon: Icon }: DashboardMetricCardProps) {
  return (
    <Card className="border-border/70 bg-card">
      <CardContent className="space-y-2 pt-5">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
          {Icon ? <Icon className="size-4 text-muted-foreground" /> : null}
        </div>
        <p className="text-3xl font-semibold tracking-tight text-foreground">{value}</p>
        {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      </CardContent>
    </Card>
  )
}
