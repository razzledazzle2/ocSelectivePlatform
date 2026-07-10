import Link from 'next/link'
import { AlertTriangleIcon, PlusIcon, UploadCloudIcon } from 'lucide-react'

import { PageHeader } from '@/components/layout/page-header'
import { QuestionBankWorkspace } from '@/components/admin/question-bank-workspace'
import { buttonVariants } from '@/components/ui/button'
import {
  getAdminQuestionsPage,
  getExistingTags,
  getQuestionStatusCounts,
  getQuestionTypes,
  getSubjects,
  getTopicsBySubject,
} from '@/lib/questions/queries'
import { getAdminQuestionStatsForPage } from '@/lib/questions/stats'
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
    questionTypeId: getSearchParamValue(resolvedSearchParams, 'questionTypeId'),
    domainCode: getSearchParamValue(resolvedSearchParams, 'domainCode'),
    subtopicCode: getSearchParamValue(resolvedSearchParams, 'subtopicCode'),
    skillCode: getSearchParamValue(resolvedSearchParams, 'skillCode'),
    questionFamily: getSearchParamValue(resolvedSearchParams, 'questionFamily'),
    stimulusFormat: getSearchParamValue(resolvedSearchParams, 'stimulusFormat'),
    patternKey: getSearchParamValue(resolvedSearchParams, 'patternKey'),
    tag: getSearchParamValue(resolvedSearchParams, 'tag'),
    difficulty: getSearchParamValue(resolvedSearchParams, 'difficulty'),
    status: getSearchParamValue(resolvedSearchParams, 'status'),
    assetState: getSearchParamValue(resolvedSearchParams, 'assetState'),
    query: getSearchParamValue(resolvedSearchParams, 'query'),
    sort: getSearchParamValue(resolvedSearchParams, 'sort'),
    page: getSearchParamValue(resolvedSearchParams, 'page'),
    pageSize: getSearchParamValue(resolvedSearchParams, 'pageSize'),
  }

  const header = (
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
        </>
      }
    />
  )

  try {
    const [subjects, topics, questionTypes, tags, data, statusCounts] = await Promise.all([
      getSubjects(),
      getTopicsBySubject(),
      getQuestionTypes(),
      getExistingTags(),
      getAdminQuestionsPage(filters),
      getQuestionStatusCounts(),
    ])

    // Stats only for the visible page's questions — never the whole bank.
    const stats = await getAdminQuestionStatsForPage(data.items.map((item) => item.id))
    const items = data.items.map((item) => ({ ...item, stats: stats.get(item.id) ?? null }))

    return (
      <div className="space-y-6">
        {header}
        <QuestionBankWorkspace
          data={{ ...data, items }}
          subjects={subjects}
          topics={topics}
          questionTypes={questionTypes}
          tags={tags.sort((a, b) => a.localeCompare(b))}
          filters={filters}
          statusCounts={statusCounts}
        />
      </div>
    )
  } catch {
    return (
      <div className="space-y-6">
        {header}
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 px-6 py-14 text-center">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
            <AlertTriangleIcon className="size-5" />
          </span>
          <p className="text-sm font-medium text-foreground">The question bank could not be loaded</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            Something went wrong while fetching questions. Check your connection and try again.
          </p>
          <Link
            href="/admin/questions"
            className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'mt-1')}
          >
            Try again
          </Link>
        </div>
      </div>
    )
  }
}
