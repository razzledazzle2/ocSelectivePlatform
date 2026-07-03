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
        {result.totalRows} detected, <span className="font-semibold text-slate-950">{result.importableCount} importable</span>
        {result.warningCount > 0 ? `, ${result.warningCount} with warnings` : ''}, {result.errorCount} error
        {result.errorCount === 1 ? '' : 's'}.
      </p>
      <div className="flex flex-wrap gap-2">
        <Badge variant="secondary">{result.totalRows} detected</Badge>
        <Badge variant="default">{result.importableCount} importable</Badge>
        {result.warningCount > 0 ? <Badge variant="outline">{result.warningCount} with warnings</Badge> : null}
        <Badge variant={result.errorCount > 0 ? 'destructive' : 'outline'}>{result.errorCount} errors</Badge>
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
