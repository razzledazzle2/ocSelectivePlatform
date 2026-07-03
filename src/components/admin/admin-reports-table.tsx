'use client'

import { QualitySignalBadge, ReportStatusBadge, ReportTypeBadge } from '@/components/admin/report-badges'
import { ReportActionsMenu } from '@/components/admin/report-actions-menu'
import { ReportDetailDialog } from '@/components/admin/report-detail-dialog'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { AdminReportListItem, ReviewerOption } from '@/lib/types'

interface AdminReportsTableProps {
  reports: AdminReportListItem[]
  reviewers: ReviewerOption[]
}

const dateFormatter = new Intl.DateTimeFormat('en-AU', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
})

export function AdminReportsTable({ reports, reviewers }: AdminReportsTableProps) {
  if (reports.length === 0) {
    return (
      <Card className="rounded-2xl border border-dashed border-border shadow-none ring-0">
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          No reports match the current filters. When students or tutors flag a question, it appears here.
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="rounded-2xl shadow-sm ring-border">
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[24rem]">Reported question</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Reports</TableHead>
              <TableHead>Report status</TableHead>
              <TableHead>Assigned</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Resolved</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {reports.map((report) => (
              <TableRow key={report.id}>
                <TableCell className="max-w-[24rem] whitespace-normal align-top">
                  <div className="space-y-2">
                    <p className="font-medium text-foreground">{report.questionTextPreview}</p>
                    <div className="flex flex-wrap gap-1.5">
                      <Badge variant="secondary">{report.subjectName}</Badge>
                      <Badge variant="outline">{report.topicName}</Badge>
                      <Badge variant="outline" className="capitalize">
                        {report.questionStatus}
                      </Badge>
                    </div>
                    {report.qualitySignals.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {report.qualitySignals.map((signal) => (
                          <QualitySignalBadge key={signal.type} signal={signal} />
                        ))}
                      </div>
                    ) : null}
                    {report.message ? (
                      <p className="line-clamp-2 text-xs text-muted-foreground">“{report.message}”</p>
                    ) : null}
                  </div>
                </TableCell>
                <TableCell className="align-top">
                  <ReportTypeBadge type={report.reportType} />
                </TableCell>
                <TableCell className="align-top">
                  <span className="text-sm font-medium text-foreground">
                    {report.questionOpenReportCount} open
                  </span>
                  <span className="text-xs text-muted-foreground"> / {report.questionReportCount}</span>
                </TableCell>
                <TableCell className="align-top">
                  <ReportStatusBadge status={report.status} />
                </TableCell>
                <TableCell className="align-top text-sm">
                  {report.assignedToName ?? <span className="text-muted-foreground">Unassigned</span>}
                </TableCell>
                <TableCell className="align-top text-sm text-muted-foreground">
                  {dateFormatter.format(new Date(report.createdAt))}
                </TableCell>
                <TableCell className="align-top text-sm text-muted-foreground">
                  {report.resolvedAt ? dateFormatter.format(new Date(report.resolvedAt)) : '—'}
                </TableCell>
                <TableCell className="align-top text-right">
                  <div className="flex justify-end gap-2">
                    <ReportDetailDialog questionId={report.questionId} />
                    <ReportActionsMenu
                      reportId={report.id}
                      questionId={report.questionId}
                      status={report.status}
                      reviewers={reviewers}
                    />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
