import Link from 'next/link'
import { notFound } from 'next/navigation'

import { QuestionPreview } from '@/components/questions/question-preview'
import { buttonVariants } from '@/components/ui/button'
import { getQuestionById } from '@/lib/questions/queries'
import { cn } from '@/lib/utils'

interface PreviewAdminQuestionPageProps {
  params: Promise<{
    id: string
  }>
}

export default async function PreviewAdminQuestionPage({ params }: PreviewAdminQuestionPageProps) {
  const { id } = await params
  const question = await getQuestionById(id)

  if (!question) {
    notFound()
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-cyan-700">Question Bank</p>
          <h2 className="mt-2 text-3xl font-semibold text-slate-950">Preview question</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Review the student-facing experience before you publish or update this question.
          </p>
        </div>
        <Link
          href={`/admin/questions/${question.id}/edit`}
          className={cn(buttonVariants({ variant: 'outline' }))}
        >
          Edit question
        </Link>
      </div>

      <QuestionPreview question={question} />
    </div>
  )
}
