import { PageHeader } from '@/components/layout/page-header'
import { RevisionSessionRunner } from '@/components/student/revision-session-runner'
import { requireProfile } from '@/lib/auth/require-profile'
import { getDueRevisionQueue } from '@/lib/revision/queries'
import { STUDENT_PORTAL_ROLES } from '@/lib/types'

export default async function RevisionSessionPage() {
  const profile = await requireProfile({ allowedRoles: [...STUDENT_PORTAL_ROLES] })
  const queue = await getDueRevisionQueue(profile.id, 10)

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Revision Session"
        title="Turn mistakes into strengths"
        description={
          queue.items.length > 0
            ? `A focused batch of ${queue.items.length} due question${queue.items.length === 1 ? '' : 's'}${
                queue.totalDue > queue.items.length ? ` (of ${queue.totalDue} due today)` : ''
              }. Answer each one to move it up the mastery ladder.`
            : 'Short, spaced reviews move knowledge into long-term memory.'
        }
      />
      <RevisionSessionRunner items={queue.items} totalDue={queue.totalDue} />
    </div>
  )
}
