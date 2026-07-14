import Link from 'next/link'
import { BookOpenIcon } from 'lucide-react'

import { PageHeader } from '@/components/layout/page-header'
import { NextReviewCard } from '@/components/student/revision/next-review-card'
import { RevisionQueue } from '@/components/student/revision/queue'
import { RevisionSummaryStrip } from '@/components/student/revision/summary-strip'
import { buttonVariants } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { requireProfile } from '@/lib/auth/require-profile'
import { getRevisionQueuePage, getRevisionSummary } from '@/lib/revision/queries'
import { STUDENT_PORTAL_ROLES } from '@/lib/types'
import { cn } from '@/lib/utils'

export default async function StudentRevisionPage() {
  const profile = await requireProfile({ allowedRoles: [...STUDENT_PORTAL_ROLES] })

  const [summary, featuredPage, queuePage] = await Promise.all([
    getRevisionSummary(profile.id),
    getRevisionQueuePage(profile.id, { filter: 'due_now', page: 0, limit: 1 }),
    getRevisionQueuePage(profile.id, { filter: 'due_now', page: 0, limit: 20 }),
  ])

  const featured = featuredPage.items[0] ?? null
  const queueForDisplay = {
    ...queuePage,
    items: queuePage.items.filter((item) => item.id !== featured?.id),
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Smart Revision"
        title="Turn mistakes into strengths"
        description="Every question you miss is scheduled for spaced review — 1 day, then 7, 30 and 180 days. Four correct reviews in a row and it counts as mastered."
      />

      {summary.totalCount === 0 ? (
        <EmptyState
          icon={BookOpenIcon}
          title="No mistakes to review yet"
          description="When you answer a question incorrectly during practice, it is saved here so you can revise it and improve over time."
          action={
            <Link href="/student/practice" className={cn(buttonVariants({ variant: 'default' }))}>
              Start practising
            </Link>
          }
        />
      ) : (
        <>
          <RevisionSummaryStrip summary={summary} />
          {featured ? <NextReviewCard mistake={featured} /> : null}
          <RevisionQueue initialFilter="due_now" initialPage={queueForDisplay} summary={summary} />
        </>
      )}
    </div>
  )
}
