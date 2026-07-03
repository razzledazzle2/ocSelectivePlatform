import { PageHeader } from '@/components/layout/page-header'
import { MockExamLanding } from '@/components/student/mock-exams/mock-exam-landing'
import { requireProfile } from '@/lib/auth/require-profile'
import { getRecentMockExams } from '@/lib/mock-exams/queries'
import { getSubjects } from '@/lib/questions/queries'
import { STUDENT_PORTAL_ROLES, type ExamType } from '@/lib/types'

export default async function StudentMockExamsPage() {
  const profile = await requireProfile({ allowedRoles: [...STUDENT_PORTAL_ROLES] })
  const [subjects, recentExams] = await Promise.all([
    getSubjects(),
    getRecentMockExams(profile.id),
  ])

  const defaultExamType: ExamType = 'Selective'

  const activeSubjects = subjects.filter((subject) => subject.is_active)

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Mock Exams"
        title="Timed exam practice"
        description="Simulate test pressure: a countdown, no instant feedback, and a full results breakdown at the end. Every question you miss flows into Smart Revision."
      />

      <MockExamLanding
        subjects={activeSubjects}
        recentExams={recentExams}
        defaultExamType={defaultExamType}
      />
    </div>
  )
}
