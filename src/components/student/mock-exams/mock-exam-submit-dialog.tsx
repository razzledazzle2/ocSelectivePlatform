'use client'

import { AlertTriangleIcon } from 'lucide-react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface MockExamSubmitDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  answeredCount: number
  totalQuestions: number
  flaggedCount: number
  isSubmitting: boolean
  onConfirm: () => void
}

export function MockExamSubmitDialog({
  open,
  onOpenChange,
  answeredCount,
  totalQuestions,
  flaggedCount,
  isSubmitting,
  onConfirm,
}: MockExamSubmitDialogProps) {
  const unanswered = totalQuestions - answeredCount

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Submit mock exam?</DialogTitle>
          <DialogDescription>
            You cannot change your answers after submitting. Your results appear straight away.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-center">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Answered</p>
            <p className="mt-0.5 text-lg font-semibold text-slate-950">
              {answeredCount}/{totalQuestions}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-center">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Unanswered</p>
            <p className="mt-0.5 text-lg font-semibold text-slate-950">{unanswered}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-center">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Flagged</p>
            <p className="mt-0.5 text-lg font-semibold text-slate-950">{flaggedCount}</p>
          </div>
        </div>

        {unanswered > 0 ? (
          <Alert variant="destructive">
            <AlertTriangleIcon />
            <AlertTitle>
              {unanswered} question{unanswered === 1 ? '' : 's'} still unanswered
            </AlertTitle>
            <AlertDescription>
              Unanswered questions are marked incorrect and added to your revision queue.
            </AlertDescription>
          </Alert>
        ) : null}

        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Keep working</DialogClose>
          <Button onClick={onConfirm} disabled={isSubmitting}>
            {isSubmitting ? 'Submitting…' : 'Submit exam'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
