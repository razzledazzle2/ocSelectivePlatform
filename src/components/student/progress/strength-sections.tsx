import { TrendingDownIcon, TrendingUpIcon, type LucideIcon } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { formatAreaLabel } from '@/lib/dashboard/analysis'
import type { AreaInsight } from '@/lib/types'

interface StrengthSectionsProps {
  hasEnoughData: boolean
  strongest: AreaInsight[]
  needsAttention: AreaInsight[]
}

function AreaList({ areas, icon: Icon, tone }: { areas: AreaInsight[]; icon: LucideIcon; tone: 'strong' | 'weak' }) {
  if (areas.length === 0) {
    return <p className="text-sm text-muted-foreground">Not enough data in this area yet.</p>
  }
  return (
    <ul className="space-y-2">
      {areas.map((area) => (
        <li
          key={`${area.subjectName}-${area.topicName ?? ''}-${area.questionTypeName ?? ''}`}
          className="flex items-center justify-between gap-3 rounded-lg border border-border/70 px-3 py-2.5"
        >
          <div className="flex items-center gap-2 min-w-0">
            <Icon className={tone === 'strong' ? 'size-4 shrink-0 text-success' : 'size-4 shrink-0 text-warning'} />
            <span className="truncate text-sm font-medium text-foreground">{formatAreaLabel(area)}</span>
          </div>
          <Badge variant="secondary" className="shrink-0">
            {area.accuracy}%
          </Badge>
        </li>
      ))}
    </ul>
  )
}

export function StrengthSections({ hasEnoughData, strongest, needsAttention }: StrengthSectionsProps) {
  if (!hasEnoughData) {
    return (
      <Card className="rounded-2xl shadow-sm ring-border">
        <CardHeader>
          <CardTitle>Strengths & focus areas</CardTitle>
          <CardDescription>
            Keep practising across a few topics and your strongest and weakest areas will appear here.
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card className="rounded-2xl shadow-sm ring-border">
        <CardHeader>
          <CardTitle>Strongest areas</CardTitle>
          <CardDescription>Your highest-accuracy topics.</CardDescription>
        </CardHeader>
        <CardContent>
          <AreaList areas={strongest} icon={TrendingUpIcon} tone="strong" />
        </CardContent>
      </Card>
      <Card className="rounded-2xl shadow-sm ring-border">
        <CardHeader>
          <CardTitle>Needs attention</CardTitle>
          <CardDescription>Your lowest-accuracy topics.</CardDescription>
        </CardHeader>
        <CardContent>
          <AreaList areas={needsAttention} icon={TrendingDownIcon} tone="weak" />
        </CardContent>
      </Card>
    </div>
  )
}
