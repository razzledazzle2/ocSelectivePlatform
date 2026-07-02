import Link from 'next/link'

import { StudentStatsCards } from '@/components/dashboard/student-stats-cards'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { AppProfile, StudentDashboardStats } from '@/lib/types'

interface StudentDashboardOverviewProps {
  profile: AppProfile
  stats: StudentDashboardStats
}

export function StudentDashboardOverview({
  profile,
  stats,
}: StudentDashboardOverviewProps) {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-cyan-700">Learning loop</p>
          <h2 className="mt-2 text-3xl font-semibold text-slate-950">
            Welcome back, {profile.full_name?.split(' ')[0] || 'student'}
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Keep the cycle moving: practise, review mistakes, and tighten weak areas with each session.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link href="/student/practice" className={cn(buttonVariants({ variant: 'default' }))}>
            Start practice
          </Link>
          <Link href="/student/revision" className={cn(buttonVariants({ variant: 'outline' }))}>
            Open revision queue
          </Link>
        </div>
      </div>

      <StudentStatsCards stats={stats} />
    </div>
  )
}
