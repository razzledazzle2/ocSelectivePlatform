import Link from 'next/link'
import { GraduationCapIcon, TriangleAlertIcon } from 'lucide-react'

import { SectionHeader } from '@/components/layout/page-header'
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
import { MASTERY_STATES, MASTERY_STATE_META } from '@/lib/mastery/core'
import type { SubtopicAnalytics, SubtopicAnalyticsRow } from '@/lib/mastery/types'

const TABLE_LIMIT = 25

/** Percentage of students in each mastery state, as a stacked bar + counts. */
function StateDistribution({ row }: { row: SubtopicAnalyticsRow }) {
  const total = MASTERY_STATES.reduce((sum, state) => sum + row.stateCounts[state], 0)
  if (total === 0) {
    return <span className="text-xs text-muted-foreground">No students yet</span>
  }

  const tones: Record<string, string> = {
    not_started: 'bg-muted-foreground/30',
    learning: 'bg-brand',
    developing: 'bg-warning',
    proficient: 'bg-gold',
    mastered: 'bg-success',
    needs_review: 'bg-destructive',
  }

  return (
    <div className="space-y-1.5">
      <div className="flex h-2 w-full overflow-hidden rounded-full bg-muted" aria-hidden>
        {MASTERY_STATES.map((state) =>
          row.stateCounts[state] === 0 ? null : (
            <span
              key={state}
              className={tones[state]}
              style={{ width: `${(row.stateCounts[state] / total) * 100}%` }}
            />
          )
        )}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
        {MASTERY_STATES.filter((state) => row.stateCounts[state] > 0).map((state) => (
          <span key={state}>
            <span className="font-medium text-foreground">
              {Math.round((row.stateCounts[state] / total) * 100)}%
            </span>{' '}
            {MASTERY_STATE_META[state].label}
          </span>
        ))}
      </div>
    </div>
  )
}

export function StudentMasteryPanel({ analytics }: { analytics: SubtopicAnalytics }) {
  const practised = analytics.rows.filter((row) => row.studentsPractising > 0)

  return (
    <section className="space-y-4">
      <SectionHeader
        title={
          <span className="flex items-center gap-2">
            <GraduationCapIcon className="size-5 text-muted-foreground" />
            Student subtopic mastery
          </span>
        }
        description={`Scored with the same formula students see, over ${analytics.attemptsScanned} raw attempts from ${analytics.studentsWithAttempts} students.${
          analytics.truncated ? ' Only the most recent attempts were scanned, so these figures are a sample.' : ''
        }${analytics.legacyAttempts > 0 ? ` ${analytics.legacyAttempts} attempts predate the canonical taxonomy and are excluded.` : ''}`}
      />

      {practised.length === 0 ? (
        <EmptyState
          icon={GraduationCapIcon}
          title="No students have practised a canonical subtopic yet"
          description="Mastery analytics appear once students answer questions tagged with the canonical taxonomy."
        />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Students practising" value={String(analytics.studentsWithAttempts)} tone="brand" />
            <StatCard label="Subtopics in use" value={String(practised.length)} tone="gold" />
            <StatCard
              label="Commonly weak"
              value={String(analytics.weakest.filter((row) => (row.averageMastery ?? 100) < 65).length)}
              hint="Average mastery below 65%"
              tone="warning"
            />
            <StatCard
              label="Bank cannot support mastery"
              value={String(analytics.insufficientCoverage.length)}
              hint="Too few usable questions or patterns"
              tone="warning"
            />
          </div>

          <Card className="rounded-2xl">
            <CardContent className="overflow-x-auto p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Subtopic</TableHead>
                    <TableHead className="text-right">Students</TableHead>
                    <TableHead className="text-right">Avg mastery</TableHead>
                    <TableHead className="min-w-52">Mastery states</TableHead>
                    <TableHead className="text-right">Usable questions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {practised.slice(0, TABLE_LIMIT).map((row) => (
                    <TableRow key={row.subtopicCode}>
                      <TableCell>
                        <Link
                          href={`/admin/coverage/${row.domainCode}/${row.subtopicCode}`}
                          className="font-medium text-foreground hover:text-brand hover:underline"
                        >
                          {row.subtopicLabel}
                        </Link>
                        <p className="text-xs text-muted-foreground">
                          {row.subjectLabel} · {row.domainLabel}
                        </p>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{row.studentsPractising}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {row.averageMastery === null ? '—' : `${row.averageMastery}%`}
                      </TableCell>
                      <TableCell>
                        <StateDistribution row={row} />
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        <span className={row.insufficientCoverage ? 'text-warning' : undefined}>
                          {row.usableQuestions}
                        </span>
                        <span className="text-xs text-muted-foreground"> / {row.usablePatternKeys}p</span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {practised.length > TABLE_LIMIT ? (
            <p className="text-xs text-muted-foreground">
              Showing the {TABLE_LIMIT} most-practised subtopics of {practised.length}.
            </p>
          ) : null}
        </>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <HighlightCard
          title="Common weak subtopics"
          hint="Lowest average mastery across students who have practised them."
          rows={analytics.weakest}
          render={(row) => `${row.averageMastery}% · ${row.studentsPractising} students`}
        />
        <HighlightCard
          title="Insufficient question coverage"
          hint="Students cannot reach mastery here: too few usable questions or too few distinct patterns."
          rows={analytics.insufficientCoverage}
          render={(row) => `${row.usableQuestions} usable · ${row.usablePatternKeys} patterns`}
        />
      </div>
    </section>
  )
}

function HighlightCard({
  title,
  hint,
  rows,
  render,
}: {
  title: string
  hint: string
  rows: SubtopicAnalyticsRow[]
  render: (row: SubtopicAnalyticsRow) => string
}) {
  return (
    <Card className="rounded-2xl">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <TriangleAlertIcon className="size-4 text-warning" />
          {title} ({rows.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-xs text-muted-foreground">{hint}</p>
        {rows.length === 0 ? (
          <p className="text-sm text-success">Nothing flagged.</p>
        ) : (
          <ul className="divide-y divide-border text-sm">
            {rows.map((row) => (
              <li key={row.subtopicCode} className="flex items-center justify-between gap-3 py-2">
                <Link
                  href={`/admin/coverage/${row.domainCode}/${row.subtopicCode}`}
                  className="min-w-0 truncate text-foreground hover:text-brand hover:underline"
                  title={`${row.subjectLabel} › ${row.domainLabel}`}
                >
                  {row.subtopicLabel}
                </Link>
                <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{render(row)}</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
