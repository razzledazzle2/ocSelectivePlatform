import Link from 'next/link'
import { TargetIcon } from 'lucide-react'

import { PageHeader } from '@/components/layout/page-header'
import { ActivityCalendar } from '@/components/student/activity-calendar'
import { ProgressTrendChart } from '@/components/student/charts/trend-chart'
import { AreaPerformanceTable } from '@/components/student/progress/area-performance-table'
import { HistorySection } from '@/components/student/progress/history-section'
import { ProgressKpiGrid } from '@/components/student/progress/kpi-grid'
import { RangeControl } from '@/components/student/progress/range-control'
import { StrengthSections } from '@/components/student/progress/strength-sections'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { requireProfile } from '@/lib/auth/require-profile'
import { getStudentProgressData } from '@/lib/progress/queries'
import { STUDENT_PORTAL_ROLES, type ProgressRange } from '@/lib/types'
import { cn } from '@/lib/utils'

interface StudentProgressPageProps {
  searchParams: Promise<{ range?: string }>
}

function parseRange(value: string | undefined): ProgressRange {
  return value === '7d' || value === '30d' || value === 'term' || value === 'all' ? value : '30d'
}

export default async function StudentProgressPage({ searchParams }: StudentProgressPageProps) {
  const profile = await requireProfile({ allowedRoles: [...STUDENT_PORTAL_ROLES] })
  const params = await searchParams
  const range = parseRange(params.range)
  const data = await getStudentProgressData(profile.id, range)

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Progress"
        title="Your learning analytics"
        description="A clear read on how you are tracking: accuracy, consistency, and the areas that deserve your next session."
        actions={
          <Link href="/student/practice" className={cn(buttonVariants({ variant: 'default' }))}>
            Start focused practice
          </Link>
        }
      />

      {!data.hasActivity ? (
        <EmptyState
          icon={TargetIcon}
          title="No analytics yet"
          description="Complete a few practice sets and this page fills with accuracy trends, strongest and weakest areas, and study consistency."
          action={
            <Link href="/student/practice" className={cn(buttonVariants({ variant: 'default' }))}>
              Start practising
            </Link>
          }
        />
      ) : (
        <>
          <RangeControl active={range} />

          <ProgressKpiGrid metrics={data.metrics} comparison={data.comparison} range={range} />

          <Card className="rounded-2xl shadow-sm ring-border">
            <CardHeader>
              <CardTitle>Performance trend</CardTitle>
              <CardDescription>Questions answered and accuracy over the selected period.</CardDescription>
            </CardHeader>
            <CardContent>
              <ProgressTrendChart points={data.trend} />
            </CardContent>
          </Card>

          <AreaPerformanceTable areas={data.areaPerformance} />

          <StrengthSections
            hasEnoughData={data.hasEnoughAreaData}
            strongest={data.strongestAreas}
            needsAttention={data.needsAttentionAreas}
          />

          <ActivityCalendar calendar={data.calendar} />

          <HistorySection initialPage={data.recentSessions} />
        </>
      )}
    </div>
  )
}
