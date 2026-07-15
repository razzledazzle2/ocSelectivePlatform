'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import {
  ArrowRightIcon,
  BookOpenIcon,
  ChevronRightIcon,
  RotateCcwIcon,
  SparklesIcon,
  TargetIcon,
  TrophyIcon,
} from 'lucide-react'

import { PageHeader } from '@/components/layout/page-header'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { StatCard } from '@/components/ui/stat-card'
import { MasteryStateBadge } from '@/components/student/mastery/mastery-visuals'
import { PracticeSessionSheet } from '@/components/student/learn/practice-session-sheet'
import { getSubjectVisual } from '@/lib/learn/subjects'
import { cn } from '@/lib/utils'
import type { LearnPracticeData, LearnSubjectSummary } from '@/lib/learn/queries'

interface LearnPracticeHubProps {
  data: LearnPracticeData
}

export function LearnPracticeHub({ data }: LearnPracticeHubProps) {
  const [activeSubjectCode, setActiveSubjectCode] = useState(data.subjects[0]?.code ?? '')
  const activeSubject = useMemo(
    () => data.subjects.find((subject) => subject.code === activeSubjectCode) ?? data.subjects[0],
    [data.subjects, activeSubjectCode]
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title="Learn & Practice"
        description="Choose a skill, continue where you left off, or follow your recommended practice."
      />

      <RecommendedPracticeCard data={data} />

      {data.subjects.length > 0 ? (
        <SubjectTabs
          subjects={data.subjects}
          activeCode={activeSubject?.code ?? ''}
          onSelect={setActiveSubjectCode}
        />
      ) : null}

      {activeSubject ? (
        <>
          <ProgressSummary subject={activeSubject} revisionDueCount={data.revisionDueCount} />
          {activeSubject.kind === 'practice' && activeSubject.label.toLowerCase().includes('reading') ? (
            <ReadingPracticeCta program={data.program} />
          ) : null}
          <DomainGrid subject={activeSubject} />
        </>
      ) : (
        <Card className="rounded-2xl border-dashed shadow-none">
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No subjects are available for the {data.program} program yet.
          </CardContent>
        </Card>
      )}
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Recommended / continue                                                      */
/* -------------------------------------------------------------------------- */

function RecommendedPracticeCard({ data }: { data: LearnPracticeData }) {
  const topRecommendation = data.recommendations.find((rec) => rec.availableQuestions > 0)

  // 1) Revision is due — clearing it first lifts accuracy fastest.
  if (data.revisionDueCount > 0) {
    return (
      <HeroCard
        icon={RotateCcwIcon}
        tone="bg-warning-soft text-warning"
        eyebrow="Recommended next"
        title={`Review ${data.revisionDueCount} question${data.revisionDueCount === 1 ? '' : 's'}`}
        body={
          data.revisionTopAreas.length > 0
            ? `Mostly ${data.revisionTopAreas.slice(0, 3).join(', ')}. Short, spaced reviews beat cramming.`
            : 'Mistakes you have made are due for spaced review. A few minutes now locks them in.'
        }
        action={
          <Link href="/student/revision/session" className={cn(buttonVariants())}>
            Start review
          </Link>
        }
      />
    )
  }

  // 2) A ranked "practise next" suggestion exists.
  if (topRecommendation) {
    return (
      <HeroCard
        icon={TargetIcon}
        tone="bg-brand-soft text-brand"
        eyebrow="Recommended next"
        title={topRecommendation.subtopicLabel}
        body={topRecommendation.reason}
        meta={
          <div className="flex flex-wrap items-center gap-2">
            <MasteryStateBadge state={topRecommendation.state} size="sm" />
            <span className="text-xs text-muted-foreground">
              {topRecommendation.domainLabel} · ~5 min
            </span>
          </div>
        }
        action={
          <PracticeSessionSheet
            subtopicCode={topRecommendation.subtopicCode}
            subtopicLabel={topRecommendation.subtopicLabel}
            examType={data.program}
            availableQuestions={topRecommendation.availableQuestions}
            triggerLabel="Continue practising"
            triggerSize="default"
          />
        }
      />
    )
  }

  // 3) Brand-new student, or nothing left to recommend.
  return (
    <HeroCard
      icon={SparklesIcon}
      tone="bg-brand-soft text-brand"
      eyebrow="Get started"
      title={data.hasAnyAttempts ? 'Choose a skill to practise' : 'Start your first practice'}
      body={
        data.hasAnyAttempts
          ? 'Nothing is due for review right now. Pick a subject below, or run a mixed set to keep sharp.'
          : 'Choose a subject below, or begin with a balanced 10-question session.'
      }
      action={
        <Link href="/student/practice/custom" className={cn(buttonVariants())}>
          Start mixed practice
        </Link>
      }
    />
  )
}

interface HeroCardProps {
  icon: typeof SparklesIcon
  tone: string
  eyebrow: string
  title: string
  body: string
  meta?: React.ReactNode
  action: React.ReactNode
}

function HeroCard({ icon: Icon, tone, eyebrow, title, body, meta, action }: HeroCardProps) {
  return (
    <Card className="overflow-hidden rounded-2xl shadow-sm ring-border">
      <CardContent className="flex flex-col gap-4 py-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          <span className={cn('flex size-11 shrink-0 items-center justify-center rounded-2xl', tone)}>
            <Icon className="size-5" aria-hidden />
          </span>
          <div className="min-w-0 space-y-1.5">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              {eyebrow}
            </p>
            <h2 className="text-lg font-semibold tracking-tight text-foreground">{title}</h2>
            <p className="max-w-xl text-sm leading-6 text-muted-foreground">{body}</p>
            {meta}
          </div>
        </div>
        <div className="shrink-0 sm:pl-4">{action}</div>
      </CardContent>
    </Card>
  )
}

/* -------------------------------------------------------------------------- */
/* Subject tabs                                                                 */
/* -------------------------------------------------------------------------- */

function SubjectTabs({
  subjects,
  activeCode,
  onSelect,
}: {
  subjects: LearnSubjectSummary[]
  activeCode: string
  onSelect: (code: string) => void
}) {
  return (
    <div
      role="tablist"
      aria-label="Subject"
      className="-mx-1 flex snap-x gap-2 overflow-x-auto px-1 pb-1"
    >
      {subjects.map((subject) => {
        const visual = getSubjectVisual(subject.code)
        const Icon = visual.icon
        const active = subject.code === activeCode
        return (
          <button
            key={subject.code}
            role="tab"
            aria-selected={active}
            type="button"
            onClick={() => onSelect(subject.code)}
            className={cn(
              'flex shrink-0 snap-start items-center gap-2 rounded-xl border px-3.5 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand',
              active
                ? 'border-transparent bg-foreground text-background shadow-sm'
                : 'border-border bg-card text-foreground hover:bg-muted/60'
            )}
          >
            <span
              className={cn(
                'flex size-6 items-center justify-center rounded-lg',
                active ? 'bg-background/15 text-background' : visual.chip
              )}
            >
              <Icon className="size-3.5" aria-hidden />
            </span>
            {subject.label}
            {subject.progressPercent !== null ? (
              <span
                className={cn(
                  'tabular-nums text-xs',
                  active ? 'text-background/70' : 'text-muted-foreground'
                )}
              >
                {subject.progressPercent}%
              </span>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Progress summary                                                             */
/* -------------------------------------------------------------------------- */

function ProgressSummary({
  subject,
  revisionDueCount,
}: {
  subject: LearnSubjectSummary
  revisionDueCount: number
}) {
  const practiceOnly = subject.kind === 'practice'

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard
        label="Questions answered"
        value={practiceOnly ? '—' : `${subject.attemptCount ?? 0}`}
        hint={practiceOnly ? 'Not tracked for this subject yet' : `${subject.label}`}
        icon={BookOpenIcon}
        tone="gold"
      />
      <StatCard
        label="Recent accuracy"
        value={subject.recentAccuracy === null ? '—' : `${subject.recentAccuracy}%`}
        hint={subject.recentAccuracy === null ? 'Complete a session to see this' : 'Your latest answers'}
        icon={SparklesIcon}
        tone="brand"
      />
      <StatCard
        label="Subtopics mastered"
        value={practiceOnly ? '—' : `${subject.masteredCount ?? 0}`}
        hint={practiceOnly ? 'Progress coming soon' : `of ${subject.subtopicCount}`}
        icon={TrophyIcon}
        tone="success"
      />
      <StatCard
        label="Revision due"
        value={revisionDueCount === 0 ? 'None' : `${revisionDueCount}`}
        hint={revisionDueCount === 0 ? 'No revision due' : 'Across all subjects'}
        icon={RotateCcwIcon}
        tone="warning"
      />
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Reading passage-set practice CTA                                             */
/* -------------------------------------------------------------------------- */

function ReadingPracticeCta({ program }: { program: LearnPracticeData['program'] }) {
  return (
    <Card className="overflow-hidden rounded-2xl border-brand/30 bg-brand-soft/40 shadow-sm ring-border">
      <CardContent className="flex flex-col gap-4 py-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-brand-soft text-brand">
            <BookOpenIcon className="size-5" aria-hidden />
          </span>
          <div className="min-w-0 space-y-1">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Whole passages
            </p>
            <h3 className="text-base font-semibold text-foreground">Practise full reading passage sets</h3>
            <p className="text-sm text-muted-foreground">
              Read a passage and answer all its questions together, then submit to see every solution at once.
            </p>
          </div>
        </div>
        <Link
          href={`/student/practice/reading?examType=${program}`}
          className={cn(buttonVariants(), 'shrink-0')}
        >
          Start passage practice
        </Link>
      </CardContent>
    </Card>
  )
}

/* -------------------------------------------------------------------------- */
/* Domain grid                                                                  */
/* -------------------------------------------------------------------------- */

function DomainGrid({ subject }: { subject: LearnSubjectSummary }) {
  const visual = getSubjectVisual(subject.code)

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        {subject.label} domains
      </h2>
      <div className="grid gap-4 sm:grid-cols-2">
        {subject.domains.map((domain) => {
          const noQuestions = domain.availableQuestions === 0
          return (
            <Link
              key={domain.domainCode}
              href={`/student/practice/${domain.domainCode}`}
              className="group rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            >
              <Card className="h-full rounded-2xl shadow-sm ring-border transition-shadow group-hover:shadow-md">
                <CardContent className="flex h-full flex-col gap-3 pt-5">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-base font-semibold text-foreground">{domain.domainLabel}</h3>
                    <ChevronRightIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                  </div>

                  <p className="text-xs text-muted-foreground">
                    {domain.subtopicCount} skill{domain.subtopicCount === 1 ? '' : 's'}
                    {noQuestions ? '' : ` · ${domain.availableQuestions} questions`}
                    {domain.masteredCount !== null && domain.masteredCount > 0
                      ? ` · ${domain.masteredCount} mastered`
                      : ''}
                    {domain.needsReviewCount !== null && domain.needsReviewCount > 0
                      ? ` · ${domain.needsReviewCount} to review`
                      : ''}
                  </p>

                  <div className="mt-auto space-y-1.5">
                    {domain.progressPercent !== null ? (
                      <>
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-medium uppercase tracking-wide text-muted-foreground">
                            Progress
                          </span>
                          <span className="font-semibold tabular-nums text-foreground/80">
                            {domain.progressPercent}%
                          </span>
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                          <div
                            className={cn('h-full rounded-full transition-all', visual.bar)}
                            style={{ width: `${Math.max(2, domain.progressPercent)}%` }}
                          />
                        </div>
                      </>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
                        {noQuestions ? 'Questions coming soon' : 'Explore skills'}
                        <ArrowRightIcon className="size-3" aria-hidden />
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            </Link>
          )
        })}
      </div>
    </section>
  )
}
