import { redirect } from 'next/navigation'

import { LearnPracticeHub } from '@/components/student/learn/learn-practice-hub'
import { requireProfile } from '@/lib/auth/require-profile'
import { getLearnPracticeData } from '@/lib/learn/queries'
import { getActiveProgram } from '@/lib/student-program/program'
import { STUDENT_PORTAL_ROLES } from '@/lib/types'

export const dynamic = 'force-dynamic'

interface StudentPracticePageProps {
  searchParams: Promise<{
    subject?: string
    subtopicCode?: string
    subjectId?: string
    topicId?: string
  }>
}

export default async function StudentPracticePage({ searchParams }: StudentPracticePageProps) {
  const profile = await requireProfile({ allowedRoles: [...STUDENT_PORTAL_ROLES] })
  const [params, program] = await Promise.all([searchParams, getActiveProgram(profile.id)])

  // Backward compatibility with the old deep links that pointed at this page.
  if (params.subtopicCode) {
    redirect(
      `/student/practice/session?subtopicCode=${encodeURIComponent(params.subtopicCode)}&examType=${program}`
    )
  }
  if (params.subjectId || params.topicId) {
    const query = new URLSearchParams()
    if (params.subjectId) query.set('subjectId', params.subjectId)
    if (params.topicId) query.set('topicId', params.topicId)
    redirect(`/student/practice/custom?${query.toString()}`)
  }

  const data = await getLearnPracticeData(profile.id, program)

  return <LearnPracticeHub data={data} />
}
