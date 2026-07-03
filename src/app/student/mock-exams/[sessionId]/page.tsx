import { notFound, redirect } from 'next/navigation'

import { MockExamRunner } from '@/components/student/mock-exams/mock-exam-runner'
import { requireProfile } from '@/lib/auth/require-profile'
import { getMockExamRunnerData } from '@/lib/mock-exams/queries'
import { STUDENT_PORTAL_ROLES } from '@/lib/types'

interface MockExamRunnerPageProps {
  params: Promise<{ sessionId: string }>
}

export default async function MockExamRunnerPage({ params }: MockExamRunnerPageProps) {
  const { sessionId } = await params
  const profile = await requireProfile({ allowedRoles: [...STUDENT_PORTAL_ROLES] })

  const data = await getMockExamRunnerData(sessionId, profile.id)

  if (!data) {
    notFound()
  }

  // A finished exam should show results, not the runner.
  if (data.status !== 'in_progress') {
    redirect(`/student/mock-exams/${sessionId}/results`)
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-brand">Exam in progress</p>
        <h2 className="mt-2 text-2xl font-semibold text-foreground">{data.mockName}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Answer every question you can. You can flag questions and come back before submitting.
        </p>
      </div>

      <MockExamRunner data={data} />
    </div>
  )
}
