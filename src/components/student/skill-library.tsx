'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import {
  AlarmClockIcon,
  ArrowRightIcon,
  BookOpenIcon,
  LayersIcon,
  PenLineIcon,
  SparklesIcon,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import type { SkillCategorySummary, SkillSubjectSummary } from '@/lib/library/queries'

interface SkillLibraryProps {
  subjects: SkillSubjectSummary[]
}

function masteryTone(accuracy: number | null): string {
  if (accuracy === null) return 'bg-muted'
  if (accuracy >= 80) return 'bg-success'
  if (accuracy >= 60) return 'bg-brand'
  return 'bg-warning'
}

export function SkillLibrary({ subjects }: SkillLibraryProps) {
  const visibleSubjects = useMemo(
    () => subjects.filter((subject) => subject.categories.length > 0 || subject.slug === 'writing'),
    [subjects]
  )
  const [activeSubjectId, setActiveSubjectId] = useState(visibleSubjects[0]?.subjectId ?? '')

  if (visibleSubjects.length === 0) {
    return (
      <EmptyState
        icon={LayersIcon}
        title="The question bank is being prepared"
        description="Categories will appear here as soon as questions are published."
      />
    )
  }

  const activeSubject =
    visibleSubjects.find((subject) => subject.subjectId === activeSubjectId) ?? visibleSubjects[0]

  return (
    <div className="space-y-5">
      <Tabs value={activeSubject.subjectId} onValueChange={setActiveSubjectId}>
        <TabsList className="flex-wrap">
          {visibleSubjects.map((subject) => (
            <TabsTrigger key={subject.subjectId} value={subject.subjectId}>
              {subject.name}
              <span className="ml-1.5 text-xs tabular-nums text-muted-foreground">
                {subject.questionCount}
              </span>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        {activeSubject.description ? <span>{activeSubject.description}</span> : null}
        {activeSubject.accuracy !== null ? (
          <Badge variant="secondary">Your accuracy: {activeSubject.accuracy}%</Badge>
        ) : null}
        {activeSubject.dueCount > 0 ? (
          <Badge variant="outline" className="border-warning/40 text-warning">
            {activeSubject.dueCount} due for revision
          </Badge>
        ) : null}
      </div>

      {activeSubject.slug === 'writing' && activeSubject.categories.length === 0 ? (
        <WritingPlaceholder />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {activeSubject.categories.map((category) => (
            <CategoryCard key={category.topicId} subject={activeSubject} category={category} />
          ))}
        </div>
      )}
    </div>
  )
}

function WritingPlaceholder() {
  return (
    <Card className="rounded-2xl border-dashed shadow-none ring-0 border border-border">
      <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
        <span className="flex size-12 items-center justify-center rounded-2xl bg-gold-soft text-gold-foreground">
          <PenLineIcon className="size-5" />
        </span>
        <div className="max-w-md space-y-1">
          <h3 className="text-base font-semibold text-foreground">Writing is on its way</h3>
          <p className="text-sm leading-6 text-muted-foreground">
            Writing tasks are marked by tutors rather than multiple choice, so they work a little
            differently. You can already complete the writing section in a full mock exam.
          </p>
        </div>
        <Link href="/student/mock-exams" className={cn(buttonVariants({ variant: 'outline' }))}>
          Explore mock exams
        </Link>
      </CardContent>
    </Card>
  )
}

function CategoryCard({
  subject,
  category,
}: {
  subject: SkillSubjectSummary
  category: SkillCategorySummary
}) {
  const hasQuestions = category.questionCount > 0
  const practiceHref = `/student/practice?subjectId=${subject.subjectId}&topicId=${category.topicId}`

  return (
    <Card className="group flex flex-col rounded-2xl shadow-sm ring-border transition-shadow hover:shadow-md">
      <CardContent className="flex flex-1 flex-col gap-3 pt-5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-foreground">{category.name}</h3>
            {category.description ? (
              <p className="mt-0.5 line-clamp-2 text-xs leading-5 text-muted-foreground">
                {category.description}
              </p>
            ) : null}
          </div>
          {category.dueCount > 0 ? (
            <Badge variant="outline" className="shrink-0 gap-1 border-warning/40 text-warning">
              <AlarmClockIcon className="size-3" />
              {category.dueCount} due
            </Badge>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <BookOpenIcon className="size-3.5" />
            {hasQuestions
              ? `${category.questionCount} question${category.questionCount === 1 ? '' : 's'}`
              : 'Questions coming soon'}
          </span>
          {category.attempts > 0 ? <span>{category.attempts} attempted</span> : null}
        </div>

        <div className="mt-auto space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium uppercase tracking-wide text-muted-foreground">Mastery</span>
            <span className="font-semibold tabular-nums text-foreground/80">
              {category.accuracy !== null ? `${category.accuracy}%` : 'Not started'}
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className={cn('h-full rounded-full transition-all', masteryTone(category.accuracy))}
              style={{ width: `${category.accuracy ?? 0}%` }}
            />
          </div>
        </div>

        <div className="flex items-center gap-2 pt-1">
          {hasQuestions ? (
            <Link href={practiceHref} className={cn(buttonVariants({ size: 'sm' }), 'flex-1')}>
              <SparklesIcon className="size-3.5" />
              Start practice
            </Link>
          ) : (
            <span
              className={cn(
                buttonVariants({ size: 'sm', variant: 'outline' }),
                'flex-1 cursor-default opacity-60'
              )}
            >
              Coming soon
            </span>
          )}
          {category.dueCount > 0 ? (
            <Link
              href="/student/revision/session"
              className={cn(buttonVariants({ size: 'sm', variant: 'outline' }))}
            >
              Review
              <ArrowRightIcon className="size-3.5" />
            </Link>
          ) : null}
        </div>
      </CardContent>
    </Card>
  )
}
