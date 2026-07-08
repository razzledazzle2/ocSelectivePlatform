import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeftIcon } from 'lucide-react'

import { MockEditor } from '@/components/admin/mocks/mock-editor'
import { PageHeader } from '@/components/layout/page-header'
import { requireProfile } from '@/lib/auth/require-profile'
import { computeMockCoverage } from '@/lib/mock-tests/coverage'
import { getMockTestAttemptStats, getMockTestById } from '@/lib/mock-tests/queries'
import { getExistingTags, getSubjects, getTopicsBySubject } from '@/lib/questions/queries'
import { ADMIN_PORTAL_ROLES, type QuestionOptionLabel } from '@/lib/types'

interface AdminMockDetailPageProps {
  params: Promise<{ id: string }>
}

export default async function AdminMockDetailPage({ params }: AdminMockDetailPageProps) {
  await requireProfile({ allowedRoles: [...ADMIN_PORTAL_ROLES] })
  const { id } = await params

  const detail = await getMockTestById(id)
  if (!detail) {
    notFound()
  }

  const correctByQuestionId: Record<string, QuestionOptionLabel> = {}
  for (const section of detail.sections) {
    for (const question of section.questions) {
      if (question.correctOptionLabel) {
        correctByQuestionId[question.questionId] = question.correctOptionLabel
      }
    }
  }

  const coverage = computeMockCoverage(detail)

  const [stats, subjects, topics, tags] = await Promise.all([
    getMockTestAttemptStats(id, correctByQuestionId),
    getSubjects(),
    getTopicsBySubject(),
    getExistingTags(),
  ])

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Link
          href="/admin/mocks"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeftIcon className="size-3.5" />
          All mock tests
        </Link>
        <PageHeader eyebrow="Mock test" title={detail.title} description={detail.description ?? undefined} />
      </div>

      <MockEditor
        detail={detail}
        stats={stats}
        coverage={coverage}
        subjects={subjects}
        topics={topics}
        tags={tags.sort((a, b) => a.localeCompare(b))}
      />
    </div>
  )
}
