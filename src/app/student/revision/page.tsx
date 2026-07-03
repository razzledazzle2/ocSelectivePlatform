import { PageHeader } from '@/components/layout/page-header'
import { RevisionBoard } from '@/components/student/revision-board'
import { requireProfile } from '@/lib/auth/require-profile'
import { getStudentMistakeQuestions } from '@/lib/practice/queries'
import { STUDENT_PORTAL_ROLES } from '@/lib/types'

export default async function StudentRevisionPage() {
  const profile = await requireProfile({
    allowedRoles: [...STUDENT_PORTAL_ROLES],
  })
  const mistakes = await getStudentMistakeQuestions(profile.id)

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Smart Revision"
        title="Review mistakes until they become strengths"
        description="Every question you miss is scheduled for spaced review. Retry them here and move each one towards mastered."
      />

      <RevisionBoard mistakes={mistakes} />
    </div>
  )
}
