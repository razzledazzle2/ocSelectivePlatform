import { MistakeList } from '@/components/revision/mistake-list'
import { requireProfile } from '@/lib/auth/require-profile'
import { getStudentMistakeQuestions } from '@/lib/practice/queries'

export default async function StudentRevisionPage() {
  const profile = await requireProfile({
    allowedRoles: ['student', 'admin', 'super_admin'],
  })
  const mistakes = await getStudentMistakeQuestions(profile.id)

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-cyan-700">Revision Queue</p>
        <h2 className="mt-2 text-3xl font-semibold text-slate-950">Mistake tracking</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Review the questions you have answered incorrectly and revisit the worked solutions when you need a reset.
        </p>
      </div>

      <MistakeList mistakes={mistakes} />
    </div>
  )
}
