import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeftIcon } from 'lucide-react'

import { PageHeader } from '@/components/layout/page-header'
import { StatCard } from '@/components/ui/stat-card'
import { Card, CardContent } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { CoverageStateBadge, DifficultyDistribution } from '@/components/admin/coverage/coverage-visuals'
import { CoverageRowActions } from '@/components/admin/coverage/coverage-row-actions'
import { getDomainCoverage } from '@/lib/coverage/queries'

export const dynamic = 'force-dynamic'

interface DomainPageProps {
  params: Promise<{ domainCode: string }>
}

export default async function CoverageDomainPage({ params }: DomainPageProps) {
  const { domainCode } = await params
  const view = await getDomainCoverage(domainCode)
  if (!view) {
    notFound()
  }

  const { subject, domain } = view
  const m = domain.metrics

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Link
          href="/admin/coverage"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeftIcon className="size-4" />
          Coverage
        </Link>
        <PageHeader
          eyebrow={subject.label}
          title={
            <span className="flex items-center gap-3">
              {domain.label}
              <CoverageStateBadge state={domain.state} size="sm" />
            </span>
          }
          description={`${m.total} questions · ${domain.subtopics.length} subtopics${
            domain.unassignedToSubtopic > 0
              ? ` · ${domain.unassignedToSubtopic} not assigned to a subtopic`
              : ''
          }`}
          actions={
            <CoverageRowActions
              bankHref={`/admin/questions?domainCode=${domain.code}`}
              scope={{ domainCode: domain.code }}
              includeTemplate
            />
          }
        />
      </div>

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
                <TableHead>Subtopic</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Usable</TableHead>
                <TableHead className="text-right">Patterns</TableHead>
                <TableHead className="text-right">Asset-ready</TableHead>
                <TableHead className="text-right">Missing</TableHead>
                <TableHead className="min-w-44">Difficulty</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {domain.subtopics.map((subtopic) => {
                const sm = subtopic.metrics
                return (
                  <TableRow key={subtopic.code}>
                    <TableCell>
                      <Link
                        href={`/admin/coverage/${domain.code}/${subtopic.code}`}
                        className="font-medium text-foreground hover:text-brand hover:underline"
                      >
                        {subtopic.label}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {sm.total} questions · {sm.distinctSkills} skills
                      </p>
                    </TableCell>
                    <TableCell>
                      <CoverageStateBadge state={subtopic.state} size="sm" />
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{sm.usable}</TableCell>
                    <TableCell className="text-right tabular-nums">{sm.distinctPatternKeys}</TableCell>
                    <TableCell className="text-right tabular-nums">{sm.assetReady}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {sm.missingAssets > 0 ? (
                        <span className="text-warning">{sm.missingAssets}</span>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <DifficultyDistribution counts={sm.difficulty} />
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
