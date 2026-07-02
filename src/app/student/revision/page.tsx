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
      <div>
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-cyan-700">Revision Queue</p>
        <h2 className="mt-2 text-3xl font-semibold text-slate-950">Smart revision</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Review the questions you have missed, retry them, and move each one towards mastered.
        </p>
      </div>

      <RevisionBoard mistakes={mistakes} />
    </div>
  )
}
