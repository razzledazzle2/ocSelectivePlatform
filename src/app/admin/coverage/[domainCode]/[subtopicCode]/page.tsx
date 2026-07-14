import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeftIcon, ImageOffIcon, TimerResetIcon } from 'lucide-react'

import { PageHeader } from '@/components/layout/page-header'
import { StatCard } from '@/components/ui/stat-card'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  CoverageStateBadge,
  DifficultyDistribution,
} from '@/components/admin/coverage/coverage-visuals'
import { CoverageRowActions } from '@/components/admin/coverage/coverage-row-actions'
import { ValidateQuestionControls } from '@/components/admin/coverage/validate-question-controls'
import { getSubtopicCoverage, type CoverageQuestionListItem } from '@/lib/coverage/queries'
import { difficultyBand, DIFFICULTY_BAND_LABELS } from '@/lib/coverage/core'
import { getSkillLabel } from '@/lib/taxonomy'

export const dynamic = 'force-dynamic'

interface SubtopicPageProps {
  params: Promise<{ domainCode: string; subtopicCode: string }>
}

export default async function CoverageSubtopicPage({ params }: SubtopicPageProps) {
  const { domainCode, subtopicCode } = await params
  const view = await getSubtopicCoverage(subtopicCode)
  if (!view || view.domain.code !== domainCode) {
    notFound()
  }

  const { subject, domain, subtopic, questions, recentlyUsed, truncated } = view
  const m = subtopic.metrics

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Link
          href={`/admin/coverage/${domain.code}`}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeftIcon className="size-4" />
          {domain.label}
        </Link>
        <PageHeader
          eyebrow={`${subject.label} › ${domain.label}`}
          title={
            <span className="flex items-center gap-3">
              {subtopic.label}
              <CoverageStateBadge state={subtopic.state} size="sm" />
            </span>
          }
          description={`${m.total} questions · ${m.usable} usable · ${m.recentlyUsedInMocks} recently used in mocks`}
          actions={
            <CoverageRowActions
              bankHref={`/admin/questions?subtopicCode=${subtopic.code}`}
              scope={{ subtopicCode: subtopic.code }}
              includeTemplate
            />
          }
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Usable" value={String(m.usable)} hint="Validated, published & asset-ready" tone="success" />
        <StatCard label="Validated & published" value={String(m.validatedPublished)} tone="brand" />
        <StatCard label="Asset-ready" value={String(m.assetReady)} hint={`${m.missingAssets} missing`} tone="gold" />
        <StatCard label="Distinct patterns" value={String(m.distinctPatternKeys)} tone="default" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="rounded-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Difficulty distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <DifficultyDistribution counts={m.difficulty} />
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Question statuses</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5 text-sm">
            <StatusLine label="Draft" value={m.draft} />
            <StatusLine label="Reviewed" value={m.reviewed} />
            <StatusLine label="Published" value={m.published} />
            <StatusLine label="Archived" value={m.archived} />
            <div className="mt-2 border-t border-border pt-2">
              <StatusLine label="Validated & published" value={m.validatedPublished} strong />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <ImageOffIcon className="size-4 text-warning" />
              Asset issues
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5 text-sm">
            <StatusLine label="Asset-ready" value={m.assetReady} />
            <StatusLine label="Missing / not-ready assets" value={m.missingAssets} />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChipCard
          title={`Skills represented (${m.skillCodes.length})`}
          empty="No canonical skill assigned to any question here."
          chips={m.skillCodes.map((code) => getSkillLabel(code) ?? code)}
        />
        <ChipCard
          title={`Pattern keys represented (${m.patternKeys.length})`}
          empty="No pattern keys set — pattern diversity cannot be measured."
          chips={m.patternKeys}
        />
      </div>

      <Card className="rounded-2xl">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <TimerResetIcon className="size-4 text-muted-foreground" />
            Recently used in mocks ({recentlyUsed.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recentlyUsed.length === 0 ? (
            <p className="text-sm text-muted-foreground">No questions from this subtopic were used in a mock recently.</p>
          ) : (
            <ul className="space-y-1.5">
              {recentlyUsed.slice(0, 20).map((q) => (
                <li key={q.id} className="truncate text-sm text-muted-foreground">
                  {q.preview}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold tracking-tight text-foreground">
          Matching questions ({m.total})
          {truncated ? <span className="ml-2 text-sm font-normal text-muted-foreground">showing first {questions.length}</span> : null}
        </h2>
        {questions.length === 0 ? (
          <EmptyState
            title="No questions yet"
            description="This subtopic has no questions. Import a CSV or add questions in the Question Bank."
          />
        ) : (
          <Card className="rounded-2xl">
            <CardContent className="overflow-x-auto p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-64">Question</TableHead>
                    <TableHead>Difficulty</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Pattern</TableHead>
                    <TableHead>Asset</TableHead>
                    <TableHead>Validation</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {questions.map((q) => (
                    <QuestionRow key={q.id} q={q} />
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </section>
    </div>
  )
}

function StatusLine({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className={strong ? 'font-medium text-foreground' : 'text-muted-foreground'}>{label}</span>
      <span className="tabular-nums font-medium text-foreground">{value}</span>
    </div>
  )
}

function ChipCard({ title, chips, empty }: { title: string; chips: string[]; empty: string }) {
  return (
    <Card className="rounded-2xl">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {chips.length === 0 ? (
          <p className="text-sm text-muted-foreground">{empty}</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {chips.map((chip) => (
              <span
                key={chip}
                className="rounded-full border border-border px-2.5 py-0.5 text-xs text-foreground"
              >
                {chip}
              </span>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'outline'> = {
  published: 'default',
  reviewed: 'secondary',
  draft: 'outline',
  archived: 'outline',
}

function QuestionRow({ q }: { q: CoverageQuestionListItem }) {
  const band = difficultyBand(q.difficulty)
  return (
    <TableRow>
      <TableCell className="max-w-md">
        <p className="truncate text-sm text-foreground">{q.preview}</p>
        {q.skillCode ? (
          <p className="truncate text-xs text-muted-foreground">{getSkillLabel(q.skillCode) ?? q.skillCode}</p>
        ) : null}
      </TableCell>
      <TableCell className="whitespace-nowrap text-sm">
        {q.difficulty ?? '—'}
        {band ? <span className="ml-1 text-xs text-muted-foreground">{DIFFICULTY_BAND_LABELS[band]}</span> : null}
      </TableCell>
      <TableCell>
        <Badge variant={STATUS_VARIANT[q.status] ?? 'outline'}>{q.status}</Badge>
      </TableCell>
      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{q.patternKey ?? '—'}</TableCell>
      <TableCell>
        {q.assetReady ? (
          <span className="text-xs text-success">Ready</span>
        ) : (
          <span className="text-xs text-warning">Missing</span>
        )}
      </TableCell>
      <TableCell>
        <ValidateQuestionControls questionId={q.id} validationStatus={q.validationStatus} />
      </TableCell>
    </TableRow>
  )
}
