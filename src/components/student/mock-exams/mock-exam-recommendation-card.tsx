import Link from 'next/link'
import { ArrowRightIcon, LightbulbIcon } from 'lucide-react'

import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { MockExamRecommendation } from '@/lib/mock-exams/types'

interface MockExamRecommendationCardProps {
  recommendations: MockExamRecommendation[]
}

export function MockExamRecommendationCard({
  recommendations,
}: MockExamRecommendationCardProps) {
  if (!recommendations.length) {
    return null
  }

  return (
    <Card className="border-white/70 bg-white/94 shadow-lg shadow-slate-200/50">
      <CardHeader className="border-b border-border/70">
        <CardTitle className="flex items-center gap-2">
          <LightbulbIcon className="size-4 text-amber-500" />
          Recommended next steps
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 pt-5">
        {recommendations.map((recommendation) => (
          <div
            key={recommendation.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4"
          >
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-950">{recommendation.title}</p>
              <p className="mt-0.5 text-sm leading-6 text-muted-foreground">
                {recommendation.description}
              </p>
            </div>
            <Link
              href={recommendation.href}
              className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'shrink-0')}
            >
              {recommendation.ctaLabel}
              <ArrowRightIcon className="size-4" />
            </Link>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
