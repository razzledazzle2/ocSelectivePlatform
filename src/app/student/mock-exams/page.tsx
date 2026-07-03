import { MockExamLanding } from '@/components/student/mock-exams/mock-exam-landing'
import { requireProfile } from '@/lib/auth/require-profile'
import { getRecentMockExams } from '@/lib/mock-exams/queries'
import { getSubjects } from '@/lib/questions/queries'
import { EXAM_TYPES, STUDENT_PORTAL_ROLES, type ExamType } from '@/lib/types'

export default async function StudentMockExamsPage() {
  const profile = await requireProfile({ allowedRoles: [...STUDENT_PORTAL_ROLES] })
  const [subjects, recentExams] = await Promise.all([
    getSubjects(),
    getRecentMockExams(profile.id),
  ])

  const defaultExamType: ExamType = EXAM_TYPES.includes(profile.target_exam as ExamType)
    ? (profile.target_exam as ExamType)
    : 'Selective'

  const activeSubjects = subjects.filter((subject) => subject.is_active)

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-cyan-700">Mock Exams</p>
        <h2 className="mt-2 text-3xl font-semibold text-slate-950">Timed exam practice</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Simulate test pressure: a countdown, no instant feedback, and a full results breakdown at
          the end. Every question you miss flows into Smart Revision.
        </p>
      </div>

      <MockExamLanding
        subjects={activeSubjects}
        recentExams={recentExams}
        defaultExamType={defaultExamType}
      />
    </div>
  )
}
