import { PageHeader } from '@/components/layout/page-header'
import { PracticeSession, type PracticeHubData } from '@/components/student/practice-session'
import { requireProfile } from '@/lib/auth/require-profile'
import { getStudentDashboardData } from '@/lib/dashboard/queries'
import { MASTERY_SUBJECT_CODES } from '@/lib/mastery/core'
import { getSubjects, getTopicsBySubject } from '@/lib/questions/queries'
import { getSubtopic } from '@/lib/taxonomy'
import { STUDENT_PORTAL_ROLES } from '@/lib/types'

interface StudentPracticePageProps {
  searchParams: Promise<{ subjectId?: string; topicId?: string; subtopicCode?: string }>
}

export default async function StudentPracticePage({ searchParams }: StudentPracticePageProps) {
  const profile = await requireProfile({ allowedRoles: [...STUDENT_PORTAL_ROLES] })
  const [params, subjects, topics, dashboard] = await Promise.all([
    searchParams,
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

  // Deep links from Subtopic Mastery focus the session on one canonical subtopic.
  const subtopicNode = getSubtopic(params.subtopicCode)
  const subtopicFocus =
    subtopicNode && (MASTERY_SUBJECT_CODES as readonly string[]).includes(subtopicNode.subjectCode)
      ? {
          code: subtopicNode.code,
          label: subtopicNode.label,
          domainCode: subtopicNode.domainCode,
        }
      : undefined

  // Legacy deep links preselect a topic category; ignore unknown ids.
  const initialSubjectId = subjects.some((subject) => subject.id === params.subjectId)
    ? params.subjectId
    : undefined
  const initialTopicId = topics.some(
    (topic) => topic.id === params.topicId && topic.subject_id === initialSubjectId
  )
    ? params.topicId
    : undefined

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Practice Hub"
        title="Smart, unlimited practice"
        description="Pick a subject and session length, and we build the set for you — no worksheets to scroll through. Mistakes flow into Smart Revision automatically."
      />

      <PracticeSession
        subjects={subjects.filter((subject) => subject.is_active)}
        topics={topics}
        hub={hub}
        initialSubjectId={initialSubjectId}
        initialTopicId={initialTopicId}
        subtopicFocus={subtopicFocus}
      />
    </div>
  )
}
