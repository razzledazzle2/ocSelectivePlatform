import Link from 'next/link'
import { PlayIcon } from 'lucide-react'

import { PageHeader } from '@/components/layout/page-header'
import { RevisionBoard } from '@/components/student/revision-board'
import { buttonVariants } from '@/components/ui/button'
import { requireProfile } from '@/lib/auth/require-profile'
import { getStudentMistakeQuestions } from '@/lib/practice/queries'
import { STUDENT_PORTAL_ROLES } from '@/lib/types'
import { cn } from '@/lib/utils'

export default async function StudentRevisionPage() {
  const profile = await requireProfile({
    allowedRoles: [...STUDENT_PORTAL_ROLES],
  })
  const mistakes = await getStudentMistakeQuestions(profile.id)

  const now = Date.now()
  const dueCount = mistakes.filter(
    (mistake) =>
      mistake.status !== 'mastered' &&
      mistake.nextReviewAt !== null &&
      new Date(mistake.nextReviewAt).getTime() <= now
  ).length
  const masteredCount = mistakes.filter((mistake) => mistake.status === 'mastered').length
  const masteryPercent =
    mistakes.length > 0 ? Math.round((masteredCount / mistakes.length) * 100) : 0

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Smart Revision"
        title="Turn mistakes into strengths"
        description="Every question you miss is scheduled for spaced review — 1 day, then 7, 30 and 180 days. Four correct reviews in a row and it counts as mastered."
        actions={
          dueCount > 0 ? (
            <Link href="/student/revision/session" className={cn(buttonVariants())}>
              <PlayIcon className="size-4" />
              Start revision ({Math.min(dueCount, 10)})
            </Link>
          ) : null
        }
      />

      {mistakes.length > 0 ? (
        <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-border bg-card px-4 py-3.5 shadow-sm">
          <div className="min-w-40 flex-1">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium uppercase tracking-wide text-muted-foreground">
                Progress towards mastery
              </span>
              <span className="font-semibold tabular-nums text-foreground">
                {masteredCount}/{mistakes.length} mastered
              </span>
            </div>
            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-success transition-all"
                style={{ width: `${masteryPercent}%` }}
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            {dueCount > 0
              ? `${dueCount} due today — short, regular reviews beat cramming.`
              : 'Nothing due today. New reviews unlock as their schedule comes around.'}
          </p>
        </div>
      ) : null}

      <RevisionBoard mistakes={mistakes} />
    </div>
  )
}
