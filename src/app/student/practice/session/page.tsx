import { redirect } from 'next/navigation'

import { PracticeSession, type PracticeHubData } from '@/components/student/practice-session'
import { requireProfile } from '@/lib/auth/require-profile'
import { getActiveProgram, isExamType } from '@/lib/student-program/program'
import { getSubtopic } from '@/lib/taxonomy'
import { STUDENT_PORTAL_ROLES } from '@/lib/types'

export const dynamic = 'force-dynamic'

/** The runner skips the setup hub, so these aggregates are never rendered. */
const EMPTY_HUB: PracticeHubData = {
  hasActivity: false,
  revisionDueCount: 0,
  revisionTopAreas: [],
  hasEnoughInsightData: false,
  weakest: null,
  strongest: null,
}

interface PracticeSessionPageProps {
  searchParams: Promise<{ subtopicCode?: string; examType?: string; count?: string; back?: string }>
}

export default async function PracticeSessionPage({ searchParams }: PracticeSessionPageProps) {
  const profile = await requireProfile({ allowedRoles: [...STUDENT_PORTAL_ROLES] })
  const params = await searchParams

  const subtopic = getSubtopic(params.subtopicCode)
  if (!subtopic) {
    // No valid target — send the student back to browse.
    redirect('/student/practice')
  }

  const program = isExamType(params.examType)
    ? params.examType
    : await getActiveProgram(profile.id)

  const backHref = params.back?.startsWith('/student/practice') ? params.back : '/student/practice'
  const count = params.count && /^\d+$/.test(params.count) ? params.count : '10'

  return (
    <div className="space-y-6">
      <PracticeSession
        subjects={[]}
        topics={[]}
        hub={EMPTY_HUB}
        subtopicFocus={{ code: subtopic.code, label: subtopic.label, domainCode: subtopic.domainCode }}
        initialExamType={program}
        initialCount={count}
        autoStart
        backHref={backHref}
      />
    </div>
  )
}
