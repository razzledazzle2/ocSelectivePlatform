import { Badge } from '@/components/ui/badge'
import type { ImportValidationResult } from '@/lib/import/types'

interface ImportValidationSummaryProps {
  result: ImportValidationResult
}

export function ImportValidationSummary({ result }: ImportValidationSummaryProps) {
  const needsFixing = result.totalRows - result.readyCount

  return (
    <div className="space-y-2">
      <p className="text-sm text-foreground">
        {result.totalRows} question{result.totalRows === 1 ? '' : 's'} detected. {result.readyCount} ready to import.
        {needsFixing > 0 ? ` ${needsFixing} need fixing.` : ''}
      </p>
      <div className="flex flex-wrap gap-2">
        <Badge variant="secondary">{result.totalRows} detected</Badge>
        <Badge variant="default">{result.readyCount} ready</Badge>
        {result.warningCount > 0 ? <Badge variant="outline">{result.warningCount} warnings</Badge> : null}
        {result.errorCount > 0 ? <Badge variant="destructive">{result.errorCount} with errors</Badge> : null}
        {result.duplicateCount > 0 ? <Badge variant="outline">{result.duplicateCount} duplicates</Badge> : null}
      </div>
    </div>
  )
}
