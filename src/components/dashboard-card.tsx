import { ArrowUpRightIcon } from 'lucide-react'

import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import type { DashboardCardIcon } from '@/lib/types'

interface DashboardCardProps {
  icon?: DashboardCardIcon
  label: string
  value: string
  detail: string
}

export function DashboardCard({ icon: Icon, label, value, detail }: DashboardCardProps) {
  return (
    <Card className="rounded-2xl border border-border shadow-card">
      <CardHeader>
        <div>
          <CardDescription>{label}</CardDescription>
          <CardTitle className="mt-2 text-3xl">{value}</CardTitle>
        </div>
        <CardAction>
          <div className="flex size-9 items-center justify-center rounded-xl bg-brand-soft text-brand">
            {Icon ? <Icon className="size-4" /> : <ArrowUpRightIcon className="size-4" />}
          </div>
        </CardAction>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">{detail}</CardContent>
    </Card>
  )
}
