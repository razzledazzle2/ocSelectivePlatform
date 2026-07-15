import { notFound } from 'next/navigation'

import { ReadingSetRunner } from '@/components/student/reading-set-runner'
import { requireProfile } from '@/lib/auth/require-profile'
import { getReadingSessionData } from '@/lib/question-sets/queries'
import { STUDENT_PORTAL_ROLES } from '@/lib/types'

export const dynamic = 'force-dynamic'

interface ReadingSessionPageProps {
  params: Promise<{ sessionId: string }>
}

export default async function ReadingSessionPage({ params }: ReadingSessionPageProps) {
  const profile = await requireProfile({ allowedRoles: [...STUDENT_PORTAL_ROLES] })
  const { sessionId } = await params

  const data = await getReadingSessionData(sessionId, profile.id)
  if (!data) {
    notFound()
  }

  return (
    <div className="space-y-6">
      <ReadingSetRunner data={data} backHref="/student/practice" />
    </div>
  )
}
