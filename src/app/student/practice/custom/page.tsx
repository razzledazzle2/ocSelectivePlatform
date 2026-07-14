import Link from 'next/link'
import { ChevronLeftIcon } from 'lucide-react'

import { PageHeader } from '@/components/layout/page-header'
import { PracticeSession, type PracticeHubData } from '@/components/student/practice-session'
import { requireProfile } from '@/lib/auth/require-profile'
import { getPracticeHubData } from '@/lib/dashboard/queries'
import { getSubjects, getTopicsBySubject } from '@/lib/questions/queries'
import { getActiveProgram } from '@/lib/student-program/program'
import { STUDENT_PORTAL_ROLES } from '@/lib/types'

export const dynamic = 'force-dynamic'

interface CustomPracticePageProps {
  searchParams: Promise<{ subjectId?: string; topicId?: string }>
}

export default async function CustomPracticePage({ searchParams }: CustomPracticePageProps) {
  const profile = await requireProfile({ allowedRoles: [...STUDENT_PORTAL_ROLES] })
  const [params, subjects, topics, hubStats, program] = await Promise.all([
    searchParams,
    getSubjects(),
    getTopicsBySubject(),
    getPracticeHubData(profile.id),
    getActiveProgram(profile.id),
  ])

  const hub: PracticeHubData = {
    hasActivity: hubStats.hasActivity,
    revisionDueCount: hubStats.revisionDue.dueCount,
    revisionTopAreas: hubStats.revisionDue.topAreas.map((area) => area.name),
    hasEnoughInsightData: hubStats.insights.hasEnoughData,
    weakest: hubStats.insights.weakest,
    strongest: hubStats.insights.strongest,
  }

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
      <Link
        href="/student/practice"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeftIcon className="size-4" />
        Learn &amp; Practice
      </Link>

      <PageHeader
        title="Custom practice"
        description="Build a set exactly how you want it — choose the subject, topic, difficulty, length and mode. Mistakes still flow into Smart Revision automatically."
      />

      <PracticeSession
        subjects={subjects.filter((subject) => subject.is_active)}
        topics={topics}
        hub={hub}
        initialSubjectId={initialSubjectId}
        initialTopicId={initialTopicId}
        initialExamType={program}
      />
    </div>
  )
}
