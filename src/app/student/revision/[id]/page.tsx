import Link from 'next/link'
import { notFound } from 'next/navigation'

import { QuestionPreview } from '@/components/questions/question-preview'
import { buttonVariants } from '@/components/ui/button'
import { requireProfile } from '@/lib/auth/require-profile'
import { getMistakeQuestionById } from '@/lib/practice/queries'
import { STUDENT_PORTAL_ROLES } from '@/lib/types'
import { cn } from '@/lib/utils'

interface StudentRevisionDetailPageProps {
  params: Promise<{
    id: string
  }>
}

export default async function StudentRevisionDetailPage({ params }: StudentRevisionDetailPageProps) {
  const { id } = await params
  const profile = await requireProfile({
    allowedRoles: [...STUDENT_PORTAL_ROLES],
  })
  const mistakeQuestion = await getMistakeQuestionById(profile.id, id)

  if (!mistakeQuestion) {
    notFound()
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-cyan-700">Revision Queue</p>
          <h2 className="mt-2 text-3xl font-semibold text-slate-950">Review question</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Use the worked solution and explanation to understand the original mistake before trying again.
          </p>
        </div>
        <Link href="/student/revision" className={cn(buttonVariants({ variant: 'outline' }))}>
          Back to revision
        </Link>
      </div>

      <QuestionPreview question={mistakeQuestion} showStatus={false} showMistakeSummary />
    </div>
  )
}
