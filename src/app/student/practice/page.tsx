import { PracticeSession } from '@/components/student/practice-session'
import { getSubjects, getTopicsBySubject } from '@/lib/questions/queries'

export default async function StudentPracticePage() {
  const [subjects, topics] = await Promise.all([getSubjects(), getTopicsBySubject()])

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-cyan-700">Practice Mode</p>
        <h2 className="mt-2 text-3xl font-semibold text-slate-950">Targeted question practice</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Choose your filters, work through one question at a time, and get feedback immediately after each answer.
        </p>
      </div>

      <PracticeSession subjects={subjects} topics={topics} />
    </div>
  )
}
