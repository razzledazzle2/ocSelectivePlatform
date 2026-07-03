'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition, type ReactNode } from 'react'
import { CheckCircle2Icon, EyeIcon, PencilIcon, RotateCcwIcon, XCircleIcon } from 'lucide-react'
import { toast } from 'sonner'

import {
  getReportDetailAction,
  saveReportNoteAction,
  updateReportStatusAction,
} from '@/app/admin/reports/actions'
import { QuestionQualitySummaryCard } from '@/components/admin/question-quality-summary-card'
import { ReportStatusBadge, ReportTypeBadge } from '@/components/admin/report-badges'
import { QuestionPreview } from '@/components/questions/question-preview'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button, buttonVariants } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import type {
  ActionResult,
  QuestionReportDetailItem,
  ReportDetail,
  ReportStatus,
} from '@/lib/types'

interface ReportDetailDialogProps {
  questionId: string
}

const dateFormatter = new Intl.DateTimeFormat('en-AU', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

export function ReportDetailDialog({ questionId }: ReportDetailDialogProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [detail, setDetail] = useState<ReportDetail | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function loadDetail() {
    setLoading(true)
    setError(null)
    const result = await getReportDetailAction(questionId)
    setLoading(false)
    if (result.success && result.data) {
      setDetail(result.data)
    } else {
      setError(result.message ?? 'Unable to load the report details.')
    }
  }

  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (next) {
      void loadDetail()
    } else {
      router.refresh()
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={<Button type="button" variant="outline" size="sm" />}>
        View
      </DialogTrigger>
      <DialogContent className="max-h-[88vh] w-[calc(100%-2rem)] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Question quality review</DialogTitle>
          <DialogDescription>
            Review every report for this question, check the data, and edit or archive it.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : null}

        {error ? (
          <Alert variant="destructive">
            <AlertTitle>Could not load details</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        {detail ? (
          <div className="space-y-5">
            <QuestionQualitySummaryCard
              stats={detail.stats}
              qualitySignals={detail.qualitySignals}
              openReportCount={detail.reports.filter((report) => report.status === 'open').length}
              totalReportCount={detail.reports.length}
            />

            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-slate-950">Reported question</h3>
              <Link
                href={`/admin/questions/${questionId}/edit`}
                className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
              >
                <PencilIcon className="size-3.5" />
                Edit question
              </Link>
            </div>

            <QuestionPreview question={detail.question} />

            <Separator />

            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-slate-950">
                Reports ({detail.reports.length})
              </h3>
              {detail.reports.map((report) => (
                <ReportItem key={report.id} report={report} onChanged={() => void loadDetail()} />
              ))}
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

function ReportItem({
  report,
  onChanged,
}: {
  report: QuestionReportDetailItem
  onChanged: () => void
}) {
  const [note, setNote] = useState(report.internalNote ?? '')
  const [isPending, startTransition] = useTransition()

  function runAction(action: () => Promise<ActionResult>) {
    startTransition(async () => {
      const result = await action()
      if (result.success) {
        toast.success(result.message ?? 'Done.')
        onChanged()
      } else {
        toast.error(result.message ?? 'Something went wrong.')
      }
    })
  }

  const noteChanged = (report.internalNote ?? '') !== note.trim()

  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
      <div className="flex flex-wrap items-center gap-2">
        <ReportTypeBadge type={report.reportType} />
        <ReportStatusBadge status={report.status} />
        <span className="text-xs text-muted-foreground">
          {report.reporterName ? `by ${report.reporterName}` : 'by a student'} ·{' '}
          {dateFormatter.format(new Date(report.createdAt))}
        </span>
      </div>

      {report.message ? (
        <p className="mt-3 text-sm leading-7 text-slate-700">{report.message}</p>
      ) : (
        <p className="mt-3 text-sm italic text-muted-foreground">No message was added.</p>
      )}

      <div className="mt-3 space-y-2">
        <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Internal note
        </label>
        <Textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Add a private note for other reviewers."
          rows={2}
          maxLength={2000}
        />
        <div className="flex justify-end">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={isPending || !noteChanged}
            onClick={() => runAction(() => saveReportNoteAction(report.id, note))}
          >
            Save note
          </Button>
        </div>
      </div>

      <Separator className="my-3" />

      <div className="flex flex-wrap gap-2">
        <StatusButton
          active={report.status === 'in_review'}
          disabled={isPending}
          onClick={() => runAction(() => updateReportStatusAction(report.id, 'in_review'))}
          icon={<EyeIcon className="size-3.5" />}
          label="In review"
        />
        <StatusButton
          active={report.status === 'resolved'}
          disabled={isPending}
          onClick={() => runAction(() => updateReportStatusAction(report.id, 'resolved'))}
          icon={<CheckCircle2Icon className="size-3.5" />}
          label="Resolve"
        />
        <StatusButton
          active={report.status === 'dismissed'}
          disabled={isPending}
          onClick={() => runAction(() => updateReportStatusAction(report.id, 'dismissed'))}
          icon={<XCircleIcon className="size-3.5" />}
          label="Dismiss"
        />
        {report.status !== 'open' ? (
          <StatusButton
            active={false}
            disabled={isPending}
            onClick={() => runAction(() => updateReportStatusAction(report.id, 'open'))}
            icon={<RotateCcwIcon className="size-3.5" />}
            label="Reopen"
          />
        ) : null}
      </div>
    </div>
  )
}

function StatusButton({
  active,
  disabled,
  onClick,
  icon,
  label,
}: {
  active: boolean
  disabled: boolean
  onClick: () => void
  icon: ReactNode
  label: string
}) {
  return (
    <Button
      type="button"
      size="sm"
      variant={active ? 'secondary' : 'outline'}
      disabled={disabled || active}
      onClick={onClick}
    >
      {icon}
      {label}
    </Button>
  )
}
