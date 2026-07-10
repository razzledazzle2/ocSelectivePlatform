import { Badge } from '@/components/ui/badge'
import type { ImportValidationResult } from '@/lib/import/types'

interface ImportValidationSummaryProps {
  result: ImportValidationResult
}

const MAX_DIGEST_ISSUES = 8
const MAX_FILE_LIST = 10

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
        {result.totalRows} detected, <span className="font-semibold text-foreground">{result.importableCount} importable</span>
        {result.warningCount > 0 ? `, ${result.warningCount} with warnings` : ''}, {result.errorCount} error
        {result.errorCount === 1 ? '' : 's'}.
      </p>
      <div className="flex flex-wrap gap-2">
        <Badge variant="secondary">{result.totalRows} detected</Badge>
        <Badge variant="outline" className="border-transparent bg-success-soft text-success">
          {result.createCount} new
        </Badge>
        {result.updateCount > 0 ? (
          <Badge variant="outline" className="border-transparent bg-warning-soft text-warning">
            {result.updateCount} updated
          </Badge>
        ) : null}
        {result.unchangedCount > 0 ? <Badge variant="outline">{result.unchangedCount} unchanged</Badge> : null}
        {result.warningCount > 0 ? (
          <Badge variant="outline" className="border-transparent bg-warning-soft text-warning">
            {result.warningCount} with warnings
          </Badge>
        ) : null}
        <Badge variant={result.errorCount > 0 ? 'destructive' : 'outline'}>{result.errorCount} errors</Badge>
        {result.duplicateCount > 0 ? <Badge variant="outline">{result.duplicateCount} duplicate ids</Badge> : null}
        {result.missingAssetCount > 0 ? (
          <Badge variant="outline" className="border-transparent bg-destructive/10 text-destructive">
            {result.missingAssetCount} missing assets
          </Badge>
        ) : null}
      </div>
      {shownDigest.length > 0 ? (
        <ul className="space-y-1 rounded-xl border border-border/70 bg-muted/50 px-4 py-3 text-xs">
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
      {result.unusedAssetFiles.length > 0 ? (
        <div className="rounded-xl border border-border/70 bg-muted/50 px-4 py-3 text-xs">
          <p className="font-medium text-foreground">
            {result.unusedAssetFiles.length} uploaded file{result.unusedAssetFiles.length === 1 ? '' : 's'} not referenced by any row:
          </p>
          <p className="mt-1 font-mono text-muted-foreground">
            {result.unusedAssetFiles.slice(0, MAX_FILE_LIST).join(', ')}
            {result.unusedAssetFiles.length > MAX_FILE_LIST ? `, +${result.unusedAssetFiles.length - MAX_FILE_LIST} more` : ''}
          </p>
        </div>
      ) : null}
    </div>
  )
}
