'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import {
  ArrowRightIcon,
  BookOpenIcon,
  ChevronRightIcon,
  LayersIcon,
  RotateCcwIcon,
  SparklesIcon,
  TrophyIcon,
} from 'lucide-react'

import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { ProgressRing } from '@/components/ui/progress-ring'
import { StatCard } from '@/components/ui/stat-card'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { MasteryBar, MasteryStateBadge } from '@/components/student/mastery/mastery-visuals'
import { cn } from '@/lib/utils'
import type { MasteryRecommendation, SubjectMastery } from '@/lib/mastery/types'

/** Availability arrives as a plain record — a Map cannot cross the server boundary. */
export type AvailabilityMap = Record<string, { questions: number; patterns: number }>

interface SubjectMasteryOverviewProps {
  subjects: SubjectMastery[]
  recommendations: MasteryRecommendation[]
  availability: AvailabilityMap
  hasAnyAttempts: boolean
}

export function SubjectMasteryOverview({
  subjects,
  recommendations,
  availability,
  hasAnyAttempts,
}: SubjectMasteryOverviewProps) {
  const [activeSubjectCode, setActiveSubjectCode] = useState(subjects[0]?.subjectCode ?? '')

  const activeSubject = useMemo(
    () => subjects.find((subject) => subject.subjectCode === activeSubjectCode) ?? subjects[0],
    [subjects, activeSubjectCode]
  )

  if (!activeSubject) {
    return (
      <EmptyState
        icon={LayersIcon}
        title="Mastery is being set up"
        description="No subjects are available for mastery tracking yet. Check back soon."
      />
    )
  }

  const subjectRecommendations = recommendations.filter(
    (recommendation) => recommendation.subjectCode === activeSubject.subjectCode
  )
  const readyQuestions = activeSubject.domains
    .flatMap((domain) => domain.subtopics)
    .reduce((sum, subtopic) => sum + (availability[subtopic.subtopicCode]?.questions ?? 0), 0)

  return (
    <div className="space-y-6">
      <Tabs value={activeSubject.subjectCode} onValueChange={setActiveSubjectCode}>
        <TabsList className="flex-wrap">
          {subjects.map((subject) => (
            <TabsTrigger key={subject.subjectCode} value={subject.subjectCode}>
              {subject.subjectLabel}
              <span className="ml-1.5 text-xs tabular-nums text-muted-foreground">
                {subject.progressPercent}%
              </span>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {readyQuestions === 0 ? (
        <EmptyState
          icon={BookOpenIcon}
          title={`${activeSubject.subjectLabel} questions are being prepared`}
          description="Your teachers are still building this question bank. Mastery will start tracking as soon as questions are published."
        />
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,20rem)_1fr]">
        <Card className="rounded-2xl shadow-sm ring-border">
          <CardContent className="flex flex-col items-center gap-4 py-6 text-center">
            <ProgressRing value={activeSubject.progressPercent}>
              <span className="text-2xl font-semibold tabular-nums text-foreground">
                {activeSubject.progressPercent}%
              </span>
            </ProgressRing>
            <div className="space-y-1">
              <h3 className="text-base font-semibold text-foreground">Overall progress</h3>
              <p className="text-xs leading-5 text-muted-foreground">
                Across all {activeSubject.subtopicCount} subtopics in {activeSubject.subjectLabel}. Subtopics
                you have not started count as zero.
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-3 sm:grid-cols-2">
          <StatCard
            label="Mastered subtopics"
            value={`${activeSubject.masteredCount}`}
            hint={`of ${activeSubject.subtopicCount}`}
            icon={TrophyIcon}
            tone="success"
          />
          <StatCard
            label="Needing review"
            value={`${activeSubject.needsReviewCount}`}
            hint="Mastered before, slipped recently"
            icon={RotateCcwIcon}
            tone="warning"
          />
          <StatCard
            label="Recent performance"
            value={activeSubject.recentAccuracy === null ? '—' : `${activeSubject.recentAccuracy}%`}
            hint={
              activeSubject.recentAccuracy === null
                ? 'Answer a few more questions'
                : 'Your last answers in this subject'
            }
            icon={SparklesIcon}
            tone="brand"
          />
          <StatCard
            label="Questions answered"
            value={`${activeSubject.attemptCount}`}
            hint={`${activeSubject.startedSubtopicCount} subtopics started`}
            icon={BookOpenIcon}
            tone="gold"
          />
        </div>
      </div>

      {!hasAnyAttempts ? (
        <EmptyState
          icon={SparklesIcon}
          title="Your mastery map starts with one question"
          description="Nothing here is scored yet. Complete a short practice set and this page fills in — subtopic by subtopic."
          action={
            <Link href="/student/practice" className={cn(buttonVariants())}>
              Start practising
            </Link>
          }
        />
      ) : (
        <RecommendationList recommendations={subjectRecommendations} />
      )}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Domains</h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {activeSubject.domains.map((domain) => (
            <Link
              key={domain.domainCode}
              href={`/student/mastery/${domain.domainCode}`}
              className="group rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            >
              <Card className="h-full rounded-2xl shadow-sm ring-border transition-shadow group-hover:shadow-md">
                <CardContent className="flex h-full flex-col gap-3 pt-5">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-base font-semibold text-foreground">{domain.domainLabel}</h3>
                    <ChevronRightIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                  </div>

                  <p className="text-xs text-muted-foreground">
                    {domain.subtopicCount} subtopics · {domain.masteredCount} mastered
                    {domain.needsReviewCount > 0 ? ` · ${domain.needsReviewCount} to review` : ''}
                  </p>

                  <div className="mt-auto space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium uppercase tracking-wide text-muted-foreground">Progress</span>
                      <span className="font-semibold tabular-nums text-foreground/80">
                        {domain.progressPercent}%
                      </span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-brand transition-all"
                        style={{ width: `${domain.progressPercent}%` }}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </section>
    </div>
  )
}

function RecommendationList({ recommendations }: { recommendations: MasteryRecommendation[] }) {
  if (recommendations.length === 0) {
    return (
      <EmptyState
        icon={SparklesIcon}
        title="Nothing to recommend right now"
        description="You have just practised everything that needs attention in this subject. Come back after a break, or explore a domain below."
      />
    )
  }

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        Recommended next practice
      </h2>
      <div className="grid gap-3 lg:grid-cols-3">
        {recommendations.map((recommendation) => (
          <Card key={recommendation.subtopicCode} className="rounded-2xl shadow-sm ring-border">
            <CardContent className="flex h-full flex-col gap-3 pt-5">
              <div className="space-y-1">
                <MasteryStateBadge state={recommendation.state} size="sm" />
                <h3 className="text-base font-semibold text-foreground">{recommendation.subtopicLabel}</h3>
                <p className="text-xs text-muted-foreground">{recommendation.domainLabel}</p>
              </div>
              <p className="text-sm leading-6 text-muted-foreground">{recommendation.reason}</p>
              <div className="mt-auto flex items-center gap-2 pt-1">
                <Link
                  href={`/student/practice?subtopicCode=${recommendation.subtopicCode}`}
                  className={cn(buttonVariants({ size: 'sm' }), 'flex-1')}
                >
                  <SparklesIcon className="size-3.5" />
                  Practise this
                </Link>
                <Link
                  href={`/student/mastery/${recommendation.domainCode}/${recommendation.subtopicCode}`}
                  className={cn(buttonVariants({ size: 'sm', variant: 'outline' }))}
                  aria-label={`Open ${recommendation.subtopicLabel}`}
                >
                  <ArrowRightIcon className="size-3.5" />
                </Link>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  )
}

/** Shared row used by the domain view; kept here so both views agree on the shape. */
export function SubtopicMasteryRow({
  subtopic,
  availableQuestions,
}: {
  subtopic: SubjectMastery['domains'][number]['subtopics'][number]
  availableQuestions: number
}) {
  return (
    <div className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:gap-6">
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/student/mastery/${subtopic.domainCode}/${subtopic.subtopicCode}`}
            className="text-sm font-semibold text-foreground hover:text-brand hover:underline"
          >
            {subtopic.subtopicLabel}
          </Link>
          <MasteryStateBadge state={subtopic.state} size="sm" />
        </div>
        <MasteryBar percent={subtopic.masteryPercent} state={subtopic.state} className="max-w-md" />
      </div>

      <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs sm:grid-cols-4 sm:text-right">
        <div>
          <dt className="text-muted-foreground">Mastery</dt>
          <dd className="font-semibold tabular-nums text-foreground">
            {subtopic.masteryPercent === null ? '—' : `${subtopic.masteryPercent}%`}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Attempted</dt>
          <dd className="font-semibold tabular-nums text-foreground">{subtopic.attemptCount}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Recent</dt>
          <dd className="font-semibold tabular-nums text-foreground">
            {subtopic.recentAccuracy === null ? '—' : `${subtopic.recentAccuracy}%`}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Last practised</dt>
          <dd className="font-medium text-foreground">{formatLastPractised(subtopic.lastPractisedAt)}</dd>
        </div>
      </dl>

      <div className="shrink-0">
        {availableQuestions > 0 ? (
          <Link
            href={`/student/practice?subtopicCode=${subtopic.subtopicCode}`}
            className={cn(buttonVariants({ size: 'sm', variant: 'outline' }))}
          >
            Practise
          </Link>
        ) : (
          <span className="text-xs text-muted-foreground">No questions yet</span>
        )}
      </div>
    </div>
  )
}

function formatLastPractised(iso: string | null): string {
  if (!iso) {
    return 'Never'
  }
  const days = Math.floor((Date.now() - Date.parse(iso)) / (24 * 60 * 60 * 1000))
  if (days <= 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 30) return `${days} days ago`
  const months = Math.floor(days / 30)
  return months === 1 ? '1 month ago' : `${months} months ago`
}
