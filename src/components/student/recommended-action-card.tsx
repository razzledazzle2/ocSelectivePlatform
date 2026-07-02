import Link from 'next/link'
import { LightbulbIcon } from 'lucide-react'

import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { DashboardRecommendation } from '@/lib/types'

interface RecommendedActionCardProps {
  recommendations: DashboardRecommendation[]
}

export function RecommendedActionCard({ recommendations }: RecommendedActionCardProps) {
  return (
    <Card className="border-border/70 bg-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <LightbulbIcon className="size-4 text-muted-foreground" />
          Recommended next
        </CardTitle>
        <CardDescription>A few focused suggestions based on your recent activity.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {recommendations.map((recommendation) => (
          <div
            key={recommendation.id}
            className="flex flex-col gap-3 rounded-lg border border-border/70 p-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">{recommendation.title}</p>
              <p className="text-xs text-muted-foreground">{recommendation.description}</p>
            </div>
            <Link
              href={recommendation.href}
              className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'shrink-0')}
            >
              {recommendation.ctaLabel}
            </Link>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
