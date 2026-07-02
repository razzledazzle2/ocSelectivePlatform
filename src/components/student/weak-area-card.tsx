import { TrendingDownIcon, TrendingUpIcon } from 'lucide-react'

import { formatAreaLabel } from '@/lib/dashboard/analysis'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { AreaInsight, WeakStrongInsights } from '@/lib/types'

interface WeakAreaCardProps {
  insights: WeakStrongInsights
}

function AreaRow({
  area,
  tone,
  icon: Icon,
  heading,
}: {
  area: AreaInsight
  tone: 'strong' | 'weak'
  icon: typeof TrendingUpIcon
  heading: string
}) {
  return (
    <div className="rounded-lg border border-border/70 p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          <Icon className={tone === 'strong' ? 'size-4 text-emerald-600' : 'size-4 text-amber-600'} />
          {heading}
        </div>
        <Badge variant={tone === 'strong' ? 'default' : 'secondary'}>{area.accuracy}%</Badge>
      </div>
      <p className="mt-2 text-sm font-medium text-foreground">{formatAreaLabel(area)}</p>
      {area.questionTypeName ? (
        <p className="text-xs text-muted-foreground">{area.questionTypeName}</p>
      ) : null}
      <p className="mt-1 text-xs text-muted-foreground">
        {area.correct}/{area.attempts} correct
      </p>
    </div>
  )
}

export function WeakAreaCard({ insights }: WeakAreaCardProps) {
  return (
    <Card className="border-border/70 bg-card">
      <CardHeader>
        <CardTitle>Strengths & focus areas</CardTitle>
        <CardDescription>Based on your real practice accuracy by topic.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {!insights.hasEnoughData ? (
          <p className="text-sm text-muted-foreground">
            Insights appear once you have more practice across a few topics. Keep answering questions and your
            strongest and weakest areas will show here.
          </p>
        ) : (
          <>
            {insights.strongest ? (
              <AreaRow area={insights.strongest} tone="strong" icon={TrendingUpIcon} heading="Strongest area" />
            ) : null}
            {insights.weakest ? (
              <AreaRow area={insights.weakest} tone="weak" icon={TrendingDownIcon} heading="Focus area" />
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  )
}
