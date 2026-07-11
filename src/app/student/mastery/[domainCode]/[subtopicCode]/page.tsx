import Link from 'next/link'
import { notFound } from 'next/navigation'
import { CheckCircle2Icon, ChevronLeftIcon, SparklesIcon, XCircleIcon } from 'lucide-react'

import { PageHeader } from '@/components/layout/page-header'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { StatCard } from '@/components/ui/stat-card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { AccuracyTrendChart, MasteryStateBadge } from '@/components/student/mastery/mastery-visuals'
import { requireProfile } from '@/lib/auth/require-profile'
import { MASTERY_STATE_META } from '@/lib/mastery/core'
import { getSubtopicMasteryDetail } from '@/lib/mastery/queries'
import { STUDENT_PORTAL_ROLES } from '@/lib/types'
import { cn } from '@/lib/utils'

export const dynamic = 'force-dynamic'

interface SubtopicMasteryPageProps {
  params: Promise<{ domainCode: string; subtopicCode: string }>
}

const DIFFICULTY_LABELS = { easy: 'Easy', medium: 'Medium', hard: 'Hard' } as const

export default async function SubtopicMasteryPage({ params }: SubtopicMasteryPageProps) {
  const profile = await requireProfile({ allowedRoles: [...STUDENT_PORTAL_ROLES] })
  const { domainCode, subtopicCode } = await params
  const detail = await getSubtopicMasteryDetail(profile.id, subtopicCode)

  if (!detail || detail.domain.code !== domainCode) {
    notFound()
  }

  const { mastery, skillBreakdown, difficultyPerformance, accuracyTrend, recentAttempts } = detail
  const canPractise = detail.availableQuestions > 0

  return (
    <div className="space-y-6">
      <Link
        href={`/student/mastery/${detail.domain.code}`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeftIcon className="size-4" />
        {detail.domain.label}
      </Link>

      <PageHeader
        eyebrow={`${detail.subject.label} › ${detail.domain.label}`}
        title={mastery.subtopicLabel}
        description={MASTERY_STATE_META[mastery.state].description}
        actions={
          canPractise ? (
            <Link href={`/student/practice?subtopicCode=${mastery.subtopicCode}`} className={cn(buttonVariants())}>
              <SparklesIcon className="size-4" />
              Practise this subtopic
            </Link>
          ) : null
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <MasteryStateBadge state={mastery.state} />
        {mastery.evidenceGap ? (
          <p className="text-sm text-muted-foreground">
            {evidenceGapMessage(mastery.evidenceGap.attemptsNeeded, mastery.evidenceGap.patternsNeeded)}
          </p>
        ) : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Mastery"
          value={mastery.masteryPercent === null ? '—' : `${mastery.masteryPercent}%`}
          hint="Weighted for difficulty and recency"
          tone="brand"
        />
        <StatCard
          label="Recent accuracy"
          value={mastery.recentAccuracy === null ? '—' : `${mastery.recentAccuracy}%`}
          hint="Your latest answers here"
          tone="gold"
        />
        <StatCard label="Questions attempted" value={`${mastery.attemptCount}`} tone="default" />
        <StatCard
          label="Ready to practise"
          value={`${detail.availableQuestions}`}
          hint={canPractise ? 'Published and answer-ready' : 'Nothing available yet'}
          tone={canPractise ? 'success' : 'warning'}
        />
      </div>

      {!canPractise ? (
        <EmptyState
          icon={SparklesIcon}
          title="No questions are ready for this subtopic yet"
          description="It will become practisable as soon as questions with complete answers and diagrams are published."
        />
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="rounded-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Accuracy trend</CardTitle>
          </CardHeader>
          <CardContent>
            <AccuracyTrendChart points={accuracyTrend} />
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Performance by difficulty</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {difficultyPerformance.every((row) => row.attempts === 0) ? (
              <p className="text-sm text-muted-foreground">
                No answers yet. Difficulty breakdown appears once you have practised here.
              </p>
            ) : (
              difficultyPerformance.map((row) => (
                <div key={row.band} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-foreground">{DIFFICULTY_LABELS[row.band]}</span>
                    <span className="tabular-nums text-muted-foreground">
                      {row.attempts === 0 ? 'Not attempted' : `${row.accuracy}% of ${row.attempts}`}
                    </span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-brand"
                      style={{ width: `${row.accuracy ?? 0}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-2xl">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Skills within this subtopic</CardTitle>
        </CardHeader>
        <CardContent>
          {skillBreakdown.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Practise this subtopic and we will show which skills inside it you are strongest on.
            </p>
          ) : (
            <div className="space-y-3">
              {skillBreakdown.map((skill) => (
                <div key={skill.skillCode ?? 'general'} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-foreground">{skill.skillLabel}</span>
                    <span className="tabular-nums text-muted-foreground">
                      {skill.accuracy}% of {skill.attempts}
                    </span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-gold" style={{ width: `${skill.accuracy}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Recent attempts</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          {recentAttempts.length === 0 ? (
            <p className="px-6 pb-6 text-sm text-muted-foreground">You have not answered anything here yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Question</TableHead>
                  <TableHead>Skill</TableHead>
                  <TableHead className="text-right">Result</TableHead>
                  <TableHead className="text-right">When</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentAttempts.map((attempt) => (
                  <TableRow key={`${attempt.questionId}-${attempt.attemptedAt}`}>
                    <TableCell className="max-w-md truncate text-muted-foreground">
                      {attempt.questionText ?? 'Question no longer available'}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{attempt.skillLabel ?? '—'}</TableCell>
                    <TableCell className="text-right">
                      {attempt.isCorrect ? (
                        <span className="inline-flex items-center gap-1 text-success">
                          <CheckCircle2Icon className="size-4" aria-hidden />
                          Correct
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-warning">
                          <XCircleIcon className="size-4" aria-hidden />
                          Incorrect
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {new Date(attempt.attemptedAt).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

/** Never mentions pattern keys — students see "different kinds of questions". */
function evidenceGapMessage(attemptsNeeded: number, patternsNeeded: number): string {
  const parts: string[] = []
  if (attemptsNeeded > 0) {
    parts.push(`${attemptsNeeded} more ${attemptsNeeded === 1 ? 'question' : 'questions'}`)
  }
  if (patternsNeeded > 0) {
    parts.push(`${patternsNeeded} more ${patternsNeeded === 1 ? 'kind' : 'kinds'} of question`)
  }
  return `Answer ${parts.join(' and ')} here before we can score this reliably.`
}
