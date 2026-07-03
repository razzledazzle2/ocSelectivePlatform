'use client'

import { useState, useTransition } from 'react'
import { FlagIcon } from 'lucide-react'
import { toast } from 'sonner'

import { submitQuestionReportAction } from '@/app/actions/reports'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { REPORT_TYPE_LABELS } from '@/lib/reports/labels'
import { REPORT_TYPES, type ReportType } from '@/lib/types'

interface QuestionReportDialogProps {
  questionId: string
  triggerVariant?: 'ghost' | 'outline'
  triggerSize?: 'sm' | 'default'
  triggerLabel?: string
  className?: string
}

const reportTypeItems = Object.fromEntries(
  REPORT_TYPES.map((value) => [value, REPORT_TYPE_LABELS[value]])
) as Record<ReportType, string>

/**
 * Self-contained "Report issue" dialog for students. Opens over the current view
 * without disrupting practice: choose an issue type, optionally add detail, submit.
 */
export function QuestionReportDialog({
  questionId,
  triggerVariant = 'ghost',
  triggerSize = 'sm',
  triggerLabel = 'Report issue',
  className,
}: QuestionReportDialogProps) {
  const [open, setOpen] = useState(false)
  const [reportType, setReportType] = useState<ReportType | ''>('')
  const [message, setMessage] = useState('')
  const [isPending, startTransition] = useTransition()

  function resetForm() {
    setReportType('')
    setMessage('')
  }

  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (!next) {
      resetForm()
    }
  }

  function handleSubmit() {
    if (!reportType || isPending) {
      return
    }

    const formData = new FormData()
    formData.set('questionId', questionId)
    formData.set('reportType', reportType)
    formData.set('message', message.trim())

    startTransition(async () => {
      const result = await submitQuestionReportAction(formData)

      if (result.success) {
        toast.success(result.message ?? 'Report sent.')
        handleOpenChange(false)
      } else {
        toast.error(result.message ?? 'Unable to submit this report.')
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          <Button type="button" variant={triggerVariant} size={triggerSize} className={className} />
        }
      >
        <FlagIcon className="size-3.5" />
        {triggerLabel}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Report an issue with this question</DialogTitle>
          <DialogDescription>
            Spotted something wrong? Let our reviewers know. Your practice progress is not affected.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>What is the issue?</Label>
            <Select
              value={reportType}
              onValueChange={(value) => setReportType(value as ReportType)}
              items={reportTypeItems}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Choose an issue type" />
              </SelectTrigger>
              <SelectContent>
                {REPORT_TYPES.map((value) => (
                  <SelectItem key={value} value={value}>
                    {REPORT_TYPE_LABELS[value]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="report-message">Details (optional)</Label>
            <Textarea
              id="report-message"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="Add anything that helps us understand the problem."
              maxLength={1000}
              rows={4}
            />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={!reportType || isPending}>
            {isPending ? 'Sending...' : 'Submit report'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
