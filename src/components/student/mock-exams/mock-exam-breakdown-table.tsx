import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'
import type { MockExamBreakdownRow } from '@/lib/mock-exams/types'

interface MockExamBreakdownTableProps {
  rows: MockExamBreakdownRow[]
  labelHeading: string
  emptyMessage?: string
}

function accuracyClass(accuracy: number): string {
  if (accuracy >= 75) {
    return 'text-emerald-700'
  }
  if (accuracy >= 50) {
    return 'text-amber-700'
  }
  return 'text-red-700'
}

export function MockExamBreakdownTable({
  rows,
  labelHeading,
  emptyMessage = 'No data available.',
}: MockExamBreakdownTableProps) {
  if (!rows.length) {
    return <p className="py-6 text-sm text-muted-foreground">{emptyMessage}</p>
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{labelHeading}</TableHead>
          <TableHead className="text-right">Answered</TableHead>
          <TableHead className="text-right">Correct</TableHead>
          <TableHead className="text-right">Incorrect</TableHead>
          <TableHead className="text-right">Accuracy</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => {
          const answered = row.correct + row.incorrect
          return (
            <TableRow key={row.label}>
              <TableCell className="font-medium text-foreground">{row.label}</TableCell>
              <TableCell className="text-right text-foreground/80">
                {answered}/{row.total}
              </TableCell>
              <TableCell className="text-right text-foreground/80">{row.correct}</TableCell>
              <TableCell className="text-right text-foreground/80">
                {row.incorrect + row.unanswered}
              </TableCell>
              <TableCell className={cn('text-right font-semibold', accuracyClass(row.accuracy))}>
                {row.accuracy}%
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}
