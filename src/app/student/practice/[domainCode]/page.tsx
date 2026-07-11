import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ChevronLeftIcon, InfoIcon } from 'lucide-react'

import { PageHeader } from '@/components/layout/page-header'
import { StatCard } from '@/components/ui/stat-card'
import { SubtopicPracticeCard } from '@/components/student/learn/subtopic-practice-card'
import { requireProfile } from '@/lib/auth/require-profile'
import { getLearnDomainView } from '@/lib/learn/queries'
import { getActiveProgram } from '@/lib/student-program/program'
import { STUDENT_PORTAL_ROLES } from '@/lib/types'

export const dynamic = 'force-dynamic'

interface DomainPageProps {
  params: Promise<{ domainCode: string }>
}

export default async function LearnDomainPage({ params }: DomainPageProps) {
  const profile = await requireProfile({ allowedRoles: [...STUDENT_PORTAL_ROLES] })
  const { domainCode } = await params
  const program = await getActiveProgram(profile.id)
  const view = await getLearnDomainView(profile.id, domainCode, program)

  if (!view) {
    notFound()
  }

  const { subject, domain, subtopics } = view
  const backHref = `/student/practice/${domain.code}`
  const isMastery = subject.kind === 'mastery'
  const noQuestions = domain.availableQuestions === 0

  return (
    <div className="space-y-6">
      <Link
        href="/student/practice"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeftIcon className="size-4" />
        Learn &amp; Practice
      </Link>

      <PageHeader
        eyebrow={subject.label}
        title={domain.label}
        description={`${domain.subtopicCount} skill${domain.subtopicCount === 1 ? '' : 's'} to work through${
          noQuestions ? '' : ` · ${domain.availableQuestions} questions ready (${program})`
        }.`}
      />

      {isMastery && domain.progressPercent !== null ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Domain progress" value={`${domain.progressPercent}%`} tone="brand" />
          <StatCard
            label="Mastered"
            value={`${domain.masteredCount ?? 0}`}
            hint={`of ${domain.subtopicCount}`}
            tone="success"
          />
          <StatCard label="Needing review" value={`${domain.needsReviewCount ?? 0}`} tone="warning" />
          <StatCard label="Questions answered" value={`${domain.attemptCount ?? 0}`} tone="gold" />
        </div>
      ) : null}

      {noQuestions ? (
        <div className="flex items-start gap-2 rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
          <InfoIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
          <p>
            Questions for this domain are still being prepared. You can explore the skills below — practice
            opens up as soon as they are published.
          </p>
        </div>
      ) : null}

      <div className="space-y-3">
        {subtopics.map((subtopic) => (
          <SubtopicPracticeCard
            key={subtopic.subtopicCode}
            subtopic={subtopic}
            examType={program}
            backHref={backHref}
            detailHref={isMastery ? `/student/practice/${domain.code}/${subtopic.subtopicCode}` : undefined}
          />
        ))}
      </div>
    </div>
  )
}
