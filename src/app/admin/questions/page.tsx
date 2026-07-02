import Link from 'next/link'

import { QuestionFilters } from '@/components/admin/question-filters'
import { QuestionsTable } from '@/components/admin/questions-table'
import { buttonVariants } from '@/components/ui/button'
import { getAdminQuestions, getSubjects, getTopicsBySubject } from '@/lib/questions/queries'
import { cn } from '@/lib/utils'
import type { AdminQuestionFilters } from '@/lib/types'

interface AdminQuestionsPageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

function getSearchParamValue(
  searchParams: Record<string, string | string[] | undefined> | undefined,
  key: keyof AdminQuestionFilters
): string | undefined {
  const value = searchParams?.[key]
  return Array.isArray(value) ? value[0] : value
}

export default async function AdminQuestionsPage({ searchParams }: AdminQuestionsPageProps) {
  const resolvedSearchParams = await searchParams
  const filters: AdminQuestionFilters = {
    examType: getSearchParamValue(resolvedSearchParams, 'examType'),
    subjectId: getSearchParamValue(resolvedSearchParams, 'subjectId'),
    topicId: getSearchParamValue(resolvedSearchParams, 'topicId'),
    difficulty: getSearchParamValue(resolvedSearchParams, 'difficulty'),
    status: getSearchParamValue(resolvedSearchParams, 'status'),
    query: getSearchParamValue(resolvedSearchParams, 'query'),
  }

  const [subjects, topics, questions] = await Promise.all([
    getSubjects(),
    getTopicsBySubject(),
    getAdminQuestions(filters),
  ])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-cyan-700">Content workflow</p>
          <h2 className="mt-2 text-3xl font-semibold text-slate-950">Question Bank</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Manage OC and Selective practice questions.
          </p>
        </div>
        <Link href="/admin/questions/new" className={cn(buttonVariants({ variant: 'default' }))}>
          New question
        </Link>
      </div>

      <QuestionFilters filters={filters} subjects={subjects} topics={topics} />
      <QuestionsTable questions={questions} />
    </div>
  )
}
