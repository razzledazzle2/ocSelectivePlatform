import Link from 'next/link'
import { PlusIcon, UploadCloudIcon } from 'lucide-react'

import { ExportQuestionsCsvButton } from '@/components/admin/export-questions-csv-button'
import { PageHeader } from '@/components/layout/page-header'
import { QuestionBankWorkspace } from '@/components/admin/question-bank-workspace'
import { buttonVariants } from '@/components/ui/button'
import {
  getAdminQuestions,
  getQuestionStatusCounts,
  getSubjects,
  getTopicsBySubject,
} from '@/lib/questions/queries'
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

  const [subjects, topics, questions, statusCounts] = await Promise.all([
    getSubjects(),
    getTopicsBySubject(),
    getAdminQuestions(filters),
    getQuestionStatusCounts(),
  ])

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Content workflow"
        title="Question Bank"
        description="Manage OC and Selective practice questions."
        actions={
          <>
            <Link href="/admin/questions/new" className={cn(buttonVariants({ variant: 'default' }))}>
              <PlusIcon className="size-4" />
              Add question
            </Link>
            <Link href="/admin/import" className={cn(buttonVariants({ variant: 'outline' }))}>
              <UploadCloudIcon className="size-4" />
              Import
            </Link>
            <ExportQuestionsCsvButton questions={questions} />
          </>
        }
      />

      <QuestionBankWorkspace
        questions={questions}
        subjects={subjects}
        topics={topics}
        filters={filters}
        statusCounts={statusCounts}
      />
    </div>
  )
}
