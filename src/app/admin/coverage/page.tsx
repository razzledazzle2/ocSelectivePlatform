import Link from 'next/link'
import {
  ChevronRightIcon,
  FileWarningIcon,
  LayersIcon,
  ListChecksIcon,
} from 'lucide-react'

import { PageHeader, SectionHeader } from '@/components/layout/page-header'
import { StatCard } from '@/components/ui/stat-card'
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
import { CoverageStateBadge, DifficultyDistribution } from '@/components/admin/coverage/coverage-visuals'
import { BlankTemplateButton } from '@/components/admin/coverage/blank-template-button'
import { StudentMasteryPanel } from '@/components/admin/coverage/student-mastery-panel'
import { getCoverageOverview } from '@/lib/coverage/queries'
import { getSubtopicMasteryAnalytics } from '@/lib/mastery/admin-queries'
import type { CoverageAudit, SubjectCoverage } from '@/lib/coverage/types'

export const dynamic = 'force-dynamic'

export default async function CoverageOverviewPage() {
  const [{ subjects, audit, totalQuestions }, masteryAnalytics] = await Promise.all([
    getCoverageOverview(),
    getSubtopicMasteryAnalytics(),
  ])

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Question bank health"
        title="Coverage"
        description="Usable-question coverage for Mathematical Reasoning and Thinking Skills. A question is “usable” only when it is validated, published and asset-ready — many questions sharing one pattern is not strong coverage."
        actions={<BlankTemplateButton />}
      />

      {subjects.length === 0 ? (
        <EmptyState
          icon={LayersIcon}
          title="No coverage to show"
          description="The canonical subjects could not be resolved."
        />
      ) : (
        subjects.map((subject) => <SubjectSection key={subject.code} subject={subject} />)
      )}

      <StudentMasteryPanel analytics={masteryAnalytics} />

      <AuditSection audit={audit} totalQuestions={totalQuestions} />
    </div>
  )
}

function SubjectSection({ subject }: { subject: SubjectCoverage }) {
  const m = subject.metrics
  return (
    <section className="space-y-4">
      <SectionHeader
        title={
          <span className="flex items-center gap-3">
            {subject.label}
            <CoverageStateBadge state={subject.state} size="sm" />
          </span>
        }
        description={`${m.total} question${m.total === 1 ? '' : 's'} across ${subject.domains.length} domains.`}
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Usable" value={String(m.usable)} hint="Validated, published & asset-ready" tone="success" />
        <StatCard label="Validated & published" value={String(m.validatedPublished)} tone="brand" />
        <StatCard label="Asset-ready" value={String(m.assetReady)} tone="gold" />
        <StatCard label="Distinct patterns" value={String(m.distinctPatternKeys)} hint={`${m.distinctSkills} skills`} tone="default" />
      </div>

      <Card className="rounded-2xl">
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Domain</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Usable</TableHead>
                <TableHead className="text-right">Patterns</TableHead>
                <TableHead className="text-right">Asset-ready</TableHead>
                <TableHead className="min-w-44">Difficulty</TableHead>
                <TableHead className="sr-only">Open</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {subject.domains.map((domain) => (
                <TableRow key={domain.code}>
                  <TableCell>
                    <Link
                      href={`/admin/coverage/${domain.code}`}
                      className="font-medium text-foreground hover:text-brand hover:underline"
                    >
                      {domain.label}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {domain.subtopics.length} subtopics · {domain.metrics.total} questions
                    </p>
                  </TableCell>
                  <TableCell>
                    <CoverageStateBadge state={domain.state} size="sm" />
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{domain.metrics.usable}</TableCell>
                  <TableCell className="text-right tabular-nums">{domain.metrics.distinctPatternKeys}</TableCell>
                  <TableCell className="text-right tabular-nums">{domain.metrics.assetReady}</TableCell>
                  <TableCell>
                    <DifficultyDistribution counts={domain.metrics.difficulty} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Link
                      href={`/admin/coverage/${domain.code}`}
                      className="inline-flex text-muted-foreground hover:text-foreground"
                      aria-label={`Open ${domain.label}`}
                    >
                      <ChevronRightIcon className="size-4" />
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </section>
  )
}

function AuditSection({ audit, totalQuestions }: { audit: CoverageAudit; totalQuestions: number }) {
  const rows: Array<{ label: string; value: number; hint?: string }> = [
    { label: 'Missing subtopics', value: audit.missingSubtopics.length, hint: 'Taxonomy subtopics with zero questions' },
    { label: 'Poor pattern diversity', value: audit.poorPatternDiversity.length, hint: 'Populated subtopics under 5 patterns' },
    { label: 'Lacking hard questions', value: audit.lackingHardQuestions.length, hint: 'Populated subtopics with no difficulty 4–5' },
    { label: 'Lacking asset-ready', value: audit.lackingAssetReady.length, hint: 'Populated subtopics with 0 asset-ready' },
    { label: 'Missing canonical taxonomy', value: audit.missingCanonicalTaxonomy, hint: 'Live questions with no resolved subtopic (bank-wide)' },
    { label: 'Legacy values to review', value: audit.legacyValuesForReview, hint: 'Live questions with stale codes (bank-wide)' },
  ]

  return (
    <section className="space-y-4">
      <SectionHeader
        title={
          <span className="flex items-center gap-2">
            <ListChecksIcon className="size-5 text-muted-foreground" />
            Current-bank audit
          </span>
        }
        description={`Read-only signals from ${totalQuestions} live questions. Nothing is changed automatically.`}
      />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((row) => (
          <Card key={row.label} className="rounded-2xl">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center justify-between text-sm font-medium text-muted-foreground">
                {row.label}
                <span
                  className={
                    row.value > 0 ? 'text-lg font-semibold text-warning' : 'text-lg font-semibold text-success'
                  }
                >
                  {row.value}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="text-xs text-muted-foreground">{row.hint}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {audit.missingSubtopics.length > 0 ? (
        <Card className="rounded-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <FileWarningIcon className="size-4 text-warning" />
              Missing subtopics ({audit.missingSubtopics.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {audit.missingSubtopics.slice(0, 40).map((s) => (
              <Link
                key={`${s.domainCode}:${s.subtopicCode}`}
                href={`/admin/coverage/${s.domainCode}/${s.subtopicCode}`}
                className="rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground hover:border-brand hover:text-brand"
                title={`${s.subjectLabel} › ${s.domainLabel}`}
              >
                {s.subtopicLabel}
              </Link>
            ))}
            {audit.missingSubtopics.length > 40 ? (
              <span className="px-2 py-1 text-xs text-muted-foreground">
                +{audit.missingSubtopics.length - 40} more
              </span>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
    </section>
  )
}
