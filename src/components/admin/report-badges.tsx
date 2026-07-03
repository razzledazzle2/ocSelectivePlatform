import { AlertTriangleIcon, ClockIcon, FlagIcon, TargetIcon } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { REPORT_STATUS_LABELS, REPORT_TYPE_SHORT_LABELS } from '@/lib/reports/labels'
import { cn } from '@/lib/utils'
import type { QualitySignal, QualitySignalType, ReportStatus, ReportType } from '@/lib/types'

const STATUS_STYLES: Record<ReportStatus, string> = {
  open: 'bg-amber-100 text-amber-800',
  in_review: 'bg-sky-100 text-sky-800',
  resolved: 'bg-emerald-100 text-emerald-800',
  dismissed: 'bg-muted text-muted-foreground',
}

export function ReportStatusBadge({ status }: { status: ReportStatus }) {
  return (
    <Badge variant="outline" className={cn('border-transparent', STATUS_STYLES[status])}>
      {REPORT_STATUS_LABELS[status]}
    </Badge>
  )
}

export function ReportTypeBadge({ type }: { type: ReportType }) {
  return (
    <Badge variant="outline" className="border-border bg-muted/50 text-foreground/80">
      {REPORT_TYPE_SHORT_LABELS[type]}
    </Badge>
  )
}

const SIGNAL_ICONS: Record<QualitySignalType, typeof FlagIcon> = {
  multiple_reports: FlagIcon,
  low_accuracy: TargetIcon,
  common_wrong_answer: AlertTriangleIcon,
  high_avg_time: ClockIcon,
}

const TONE_STYLES: Record<QualitySignal['tone'], string> = {
  critical: 'bg-red-100 text-red-800',
  warning: 'bg-amber-100 text-amber-800',
  neutral: 'bg-muted text-foreground/80',
}

export function QualitySignalBadge({ signal }: { signal: QualitySignal }) {
  const Icon = SIGNAL_ICONS[signal.type]

  return (
    <Badge
      variant="outline"
      title={signal.detail}
      className={cn('cursor-help border-transparent', TONE_STYLES[signal.tone])}
    >
      <Icon className="size-3" />
      {signal.label}
    </Badge>
  )
}
