import { ArrowUpRightIcon } from 'lucide-react'

import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

export function DashboardCard({ icon: Icon, label, value, detail }) {
  return (
    <Card className="border border-border/80 bg-white/90 shadow-sm shadow-slate-200/40">
      <CardHeader className="border-b border-border/70">
        <div>
          <CardDescription>{label}</CardDescription>
          <CardTitle className="mt-2 text-3xl">{value}</CardTitle>
        </div>
        <CardAction>
          <div className="flex size-10 items-center justify-center rounded-2xl bg-slate-950 text-white">
            {Icon ? <Icon className="size-4" /> : <ArrowUpRightIcon className="size-4" />}
          </div>
        </CardAction>
      </CardHeader>
      <CardContent className="pt-4 text-sm text-muted-foreground">{detail}</CardContent>
    </Card>
  )
}
