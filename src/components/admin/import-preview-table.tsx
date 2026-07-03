import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { ValidatedImportRow } from '@/lib/import/types'

interface ImportPreviewTableProps {
  rows: ValidatedImportRow[]
}

function StatusBadge({ row }: { row: ValidatedImportRow }) {
  if (row.errors.length > 0) {
    return <Badge variant="destructive">Needs fixing</Badge>
  }
  if (row.isDuplicate) {
    return <Badge variant="outline">Duplicate — skipped</Badge>
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
              <TableHead className="min-w-[18rem]">Question</TableHead>
              <TableHead>Taxonomy</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="min-w-[16rem]">Validation</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.rowNumber}>
                <TableCell className="align-top text-sm text-muted-foreground">{row.rowNumber}</TableCell>
                <TableCell className="align-top">
                  <p className="line-clamp-2 text-sm text-foreground">{row.questionPreview}</p>
                  <p className="mt-1 text-xs text-muted-foreground">Imports as {row.statusLabel}</p>
                </TableCell>
                <TableCell className="align-top text-sm">
                  <p className="text-foreground">{row.subjectLabel}</p>
                  <p className="text-muted-foreground">{row.topicLabel}</p>
                  <p className="text-muted-foreground">{row.questionTypeLabel}</p>
                </TableCell>
                <TableCell className="align-top">
                  <StatusBadge row={row} />
                </TableCell>
                <TableCell className="align-top">
                  {row.errors.length === 0 && row.warnings.length === 0 ? (
                    <p className="text-sm text-emerald-700">Ready to import</p>
                  ) : (
                    <ul className="space-y-1 text-xs">
                      {row.errors.map((issue, index) => (
                        <li key={`e-${index}`} className="text-destructive">
                          {issue.field}: {issue.message}
                        </li>
                      ))}
                      {row.warnings.map((issue, index) => (
                        <li key={`w-${index}`} className="text-amber-700">
                          {issue.field}: {issue.message}
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
