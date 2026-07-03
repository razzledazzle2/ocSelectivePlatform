import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { QuestionStatus } from '@/lib/types'

const statusBadgeClasses: Record<QuestionStatus, string> = {
  published: 'border-transparent bg-success-soft text-success',
  draft: 'border-transparent bg-warning-soft text-warning',
  archived: 'border-transparent bg-muted text-muted-foreground',
}

interface QuestionStatusBadgeProps {
  status: QuestionStatus
  className?: string
}

/** Tone-coded status chip used in the question bank list and preview pane. */
export function QuestionStatusBadge({ status, className }: QuestionStatusBadgeProps) {
  return (
    <Badge variant="outline" className={cn('capitalize', statusBadgeClasses[status], className)}>
      {status}
    </Badge>
  )
}
