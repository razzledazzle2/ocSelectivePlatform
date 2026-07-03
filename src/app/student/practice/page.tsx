import { PageHeader } from '@/components/layout/page-header'
import { PracticeSession, type PracticeHubData } from '@/components/student/practice-session'
import { requireProfile } from '@/lib/auth/require-profile'
import { getStudentDashboardData } from '@/lib/dashboard/queries'
import { getSubjects, getTopicsBySubject } from '@/lib/questions/queries'
import { STUDENT_PORTAL_ROLES } from '@/lib/types'

export default async function StudentPracticePage() {
  const profile = await requireProfile({ allowedRoles: [...STUDENT_PORTAL_ROLES] })
  const [subjects, topics, dashboard] = await Promise.all([
    getSubjects(),
    getTopicsBySubject(),
    getStudentDashboardData(profile.id),
  ])

  const hub: PracticeHubData = {
    hasActivity: dashboard.hasActivity,
    revisionDueCount: dashboard.revisionDue.dueCount,
    revisionTopAreas: dashboard.revisionDue.topAreas.map((area) => area.name),
    hasEnoughInsightData: dashboard.insights.hasEnoughData,
    weakest: dashboard.insights.weakest,
    strongest: dashboard.insights.strongest,
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Practice Hub"
        title="Smart, unlimited practice"
        description="Pick a subject and session length, and we build the set for you — no worksheets to scroll through. Mistakes flow into Smart Revision automatically."
      />

      <PracticeSession subjects={subjects.filter((subject) => subject.is_active)} topics={topics} hub={hub} />
    </div>
  )
}
