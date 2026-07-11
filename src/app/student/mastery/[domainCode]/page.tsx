import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ChevronLeftIcon, LayersIcon } from 'lucide-react'

import { PageHeader } from '@/components/layout/page-header'
import { Card, CardContent } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { StatCard } from '@/components/ui/stat-card'
import { SubtopicMasteryRow } from '@/components/student/mastery/subject-mastery-overview'
import { requireProfile } from '@/lib/auth/require-profile'
import { getDomainMastery } from '@/lib/mastery/queries'
import { STUDENT_PORTAL_ROLES } from '@/lib/types'

export const dynamic = 'force-dynamic'

interface DomainMasteryPageProps {
  params: Promise<{ domainCode: string }>
}

export default async function DomainMasteryPage({ params }: DomainMasteryPageProps) {
  const profile = await requireProfile({ allowedRoles: [...STUDENT_PORTAL_ROLES] })
  const { domainCode } = await params
  const view = await getDomainMastery(profile.id, domainCode)

  if (!view) {
    notFound()
  }

  const { subject, domain, availability } = view
  const readyQuestions = domain.subtopics.reduce(
    (sum, subtopic) => sum + (availability.get(subtopic.subtopicCode)?.questions ?? 0),
    0
  )

  return (
    <div className="space-y-6">
      <Link
        href="/student/mastery"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeftIcon className="size-4" />
        {subject.label}
      </Link>

      <PageHeader
        eyebrow={subject.label}
        title={domain.domainLabel}
        description={`${domain.subtopicCount} subtopics. Open any subtopic to see the skills behind it, or practise it straight from this list.`}
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Domain progress" value={`${domain.progressPercent}%`} tone="brand" />
        <StatCard label="Mastered" value={`${domain.masteredCount}`} hint={`of ${domain.subtopicCount}`} tone="success" />
        <StatCard label="Needing review" value={`${domain.needsReviewCount}`} tone="warning" />
        <StatCard label="Questions answered" value={`${domain.attemptCount}`} tone="gold" />
      </div>

      {readyQuestions === 0 ? (
        <EmptyState
          icon={LayersIcon}
          title="No questions are ready in this domain yet"
          description="Subtopics still appear below so you can see what is coming, but there is nothing to practise here until questions are published."
        />
      ) : null}

      <Card className="rounded-2xl">
        <CardContent className="divide-y divide-border p-0 px-5">
          {domain.subtopics.map((subtopic) => (
            <SubtopicMasteryRow
              key={subtopic.subtopicCode}
              subtopic={subtopic}
              availableQuestions={availability.get(subtopic.subtopicCode)?.questions ?? 0}
            />
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
