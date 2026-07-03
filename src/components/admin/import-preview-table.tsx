import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { ImportRowStatus, ValidatedImportRow } from '@/lib/import/types'

interface ImportPreviewTableProps {
  rows: ValidatedImportRow[]
}

function StatusBadge({ status }: { status: ImportRowStatus }) {
  if (status === 'error') {
    return <Badge variant="destructive">Error</Badge>
  }
  if (status === 'warning') {
    return <Badge variant="secondary">Ready with warnings</Badge>
  }
  return <Badge>Ready</Badge>
}

export function ImportPreviewTable({ rows }: ImportPreviewTableProps) {
  return (
    <div className="overflow-hidden rounded-lg border border-border/70">
      <div className="max-h-[28rem] overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">#</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="min-w-[16rem]">Question</TableHead>
              <TableHead>Subject</TableHead>
              <TableHead>Topic</TableHead>
              <TableHead className="text-center">Options</TableHead>
              <TableHead className="text-center">Correct</TableHead>
              <TableHead className="min-w-[16rem]">Issues</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.rowNumber}>
                <TableCell className="align-top text-sm text-muted-foreground">{row.rowNumber}</TableCell>
                <TableCell className="align-top">
                  <StatusBadge status={row.rowStatus} />
                </TableCell>
                <TableCell className="align-top">
                  <p className="line-clamp-2 text-sm text-foreground">{row.questionPreview}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {row.questionTypeLabel} • imports as {row.statusLabel}
                  </p>
                </TableCell>
                <TableCell className="align-top text-sm">{row.subjectLabel}</TableCell>
                <TableCell className="align-top text-sm">{row.topicLabel}</TableCell>
                <TableCell className="align-top text-center text-sm">{row.optionsCount}</TableCell>
                <TableCell className="align-top text-center">
                  <Badge variant="outline">{row.correctAnswerLabel}</Badge>
                </TableCell>
                <TableCell className="align-top">
                  {row.errors.length === 0 && row.warnings.length === 0 ? (
                    <p className="text-sm text-emerald-700">Ready to import</p>
                  ) : (
                    <ul className="space-y-1 text-xs">
                      {row.errors.map((issue, index) => (
                        <li key={`e-${index}`} className="text-destructive">
                          {issue.message}
                        </li>
                      ))}
                      {row.warnings.map((issue, index) => (
                        <li key={`w-${index}`} className="text-amber-700">
                          {issue.message}
                        </li>
                      ))}
                    </ul>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
