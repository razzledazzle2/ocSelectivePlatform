import { AdminReportsTable } from '@/components/admin/admin-reports-table'
import { ReportFilters } from '@/components/admin/report-filters'
import { Card, CardContent } from '@/components/ui/card'
import { getQuestionTypes, getSubjects, getTopicsBySubject } from '@/lib/questions/queries'
import {
  getAdminReports,
  getAssignableReviewers,
  getReportQueueCounts,
} from '@/lib/reports/queries'
import type { ReportFilters as ReportFiltersType } from '@/lib/types'

interface AdminReportsPageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

function getParam(
  searchParams: Record<string, string | string[] | undefined> | undefined,
  key: keyof ReportFiltersType
): string | undefined {
  const value = searchParams?.[key]
  return Array.isArray(value) ? value[0] : value
}

function CountTile({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <Card className="rounded-2xl border border-border shadow-card">
      <CardContent className="px-4 py-4">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className={`mt-1 text-2xl font-semibold ${accent}`}>{value}</p>
      </CardContent>
    </Card>
  )
}

export default async function AdminReportsPage({ searchParams }: AdminReportsPageProps) {
  const resolvedSearchParams = await searchParams
  const filters: ReportFiltersType = {
    status: getParam(resolvedSearchParams, 'status'),
    reportType: getParam(resolvedSearchParams, 'reportType'),
    subjectId: getParam(resolvedSearchParams, 'subjectId'),
    topicId: getParam(resolvedSearchParams, 'topicId'),
    questionTypeId: getParam(resolvedSearchParams, 'questionTypeId'),
    questionStatus: getParam(resolvedSearchParams, 'questionStatus'),
    assignedTo: getParam(resolvedSearchParams, 'assignedTo'),
  }

  const [reports, subjects, topics, questionTypes, reviewers, counts] = await Promise.all([
    getAdminReports(filters),
    getSubjects(),
    getTopicsBySubject(),
    getQuestionTypes(),
    getAssignableReviewers(),
    getReportQueueCounts(),
  ])

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-brand">Content quality control</p>
        <h2 className="mt-2 text-3xl font-semibold text-foreground">Question Reports</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Review issues raised by students and tutors, act on the ones that matter, and protect the quality of the
          question bank.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <CountTile label="Open" value={counts.open} accent="text-amber-700" />
        <CountTile label="In review" value={counts.inReview} accent="text-sky-700" />
        <CountTile label="Resolved" value={counts.resolved} accent="text-emerald-700" />
        <CountTile label="Dismissed" value={counts.dismissed} accent="text-muted-foreground" />
      </div>

      <ReportFilters
        filters={filters}
        subjects={subjects}
        topics={topics}
        questionTypes={questionTypes}
        reviewers={reviewers}
      />
      <AdminReportsTable reports={reports} reviewers={reviewers} />
    </div>
  )
}
