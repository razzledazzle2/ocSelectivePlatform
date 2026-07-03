import { Badge } from '@/components/ui/badge'
import type { ImportValidationResult } from '@/lib/import/types'

interface ImportValidationSummaryProps {
  result: ImportValidationResult
}

const MAX_DIGEST_ISSUES = 8

export function ImportValidationSummary({ result }: ImportValidationSummaryProps) {
  // A short digest of the exact problems, e.g.
  // "Question 6: Correct answer is E but only A–D options were parsed."
  const digest = result.rows.flatMap((row) => [
    ...row.errors.map((issue) => ({ rowNumber: row.rowNumber, message: issue.message, tone: 'error' as const })),
    ...row.warnings.map((issue) => ({ rowNumber: row.rowNumber, message: issue.message, tone: 'warning' as const })),
  ])
  const shownDigest = digest.slice(0, MAX_DIGEST_ISSUES)
  const hiddenCount = digest.length - shownDigest.length

  return (
    <div className="space-y-3">
      <p className="text-sm text-foreground">
        {result.totalRows} question{result.totalRows === 1 ? '' : 's'} detected. {result.readyCount} ready to
        import.
        {result.totalRows - result.readyCount > 0 ? ` ${result.totalRows - result.readyCount} need attention.` : ''}
      </p>
      <div className="flex flex-wrap gap-2">
        <Badge variant="secondary">{result.totalRows} detected</Badge>
        <Badge variant="default">{result.readyCount} ready</Badge>
        {result.warningCount > 0 ? <Badge variant="outline">{result.warningCount} warnings</Badge> : null}
        {result.errorCount > 0 ? <Badge variant="destructive">{result.errorCount} errors</Badge> : null}
        {result.duplicateCount > 0 ? <Badge variant="outline">{result.duplicateCount} duplicates</Badge> : null}
      </div>
      {shownDigest.length > 0 ? (
        <ul className="space-y-1 rounded-xl border border-border/70 bg-slate-50 px-4 py-3 text-xs">
          {shownDigest.map((issue, index) => (
            <li key={index} className={issue.tone === 'error' ? 'text-destructive' : 'text-amber-700'}>
              Question {issue.rowNumber}: {issue.message}
            </li>
          ))}
          {hiddenCount > 0 ? (
            <li className="text-muted-foreground">…and {hiddenCount} more. See the table below for details.</li>
          ) : null}
        </ul>
      ) : null}
    </div>
  )
}
