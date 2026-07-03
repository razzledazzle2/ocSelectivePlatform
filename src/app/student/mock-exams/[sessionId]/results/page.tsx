import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'

import { buttonVariants } from '@/components/ui/button'
import { MockExamResultsView } from '@/components/student/mock-exams/mock-exam-results'
import { requireProfile } from '@/lib/auth/require-profile'
import { getMockExamResults } from '@/lib/mock-exams/results'
import { STUDENT_PORTAL_ROLES } from '@/lib/types'
import { cn } from '@/lib/utils'

interface MockExamResultsPageProps {
  params: Promise<{ sessionId: string }>
}

export default async function MockExamResultsPage({ params }: MockExamResultsPageProps) {
  const { sessionId } = await params
  const profile = await requireProfile({ allowedRoles: [...STUDENT_PORTAL_ROLES] })

  const results = await getMockExamResults(sessionId, profile.id)

  if (!results) {
    notFound()
  }

  // Still in progress: send the student back to finish the exam.
  if (results.session.status === 'in_progress') {
    redirect(`/student/mock-exams/${sessionId}`)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-brand">
            Mock exam results
          </p>
          <h2 className="mt-2 text-3xl font-semibold text-foreground">{results.session.mockName}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {results.session.examType}
            {results.session.subjectName ? ` · ${results.session.subjectName}` : ''}
          </p>
        </div>
        <Link
          href="/student/mock-exams"
          className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
        >
          Back to mock exams
        </Link>
      </div>

      <MockExamResultsView results={results} />
    </div>
  )
}
