'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'

import { removeFromReviewQueueAction } from '@/app/student/revision/actions'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'

interface RemoveFromQueueDialogProps {
  questionId: string
  onRemoved?: () => void
}

/**
 * A confirmed, low-emphasis alternative to the old one-click "Mark understood"
 * (which silently set status: 'mastered' with no re-test). This states the
 * consequence up front — the normal path to mastery is four correct retries in
 * a row; this just stops the reminders.
 */
export function RemoveFromQueueDialog({ questionId, onRemoved }: RemoveFromQueueDialogProps) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  function handleConfirm() {
    startTransition(async () => {
      const result = await removeFromReviewQueueAction(questionId)
      if (result.success) {
        toast.success(result.message ?? 'Removed from your review queue.')
        setOpen(false)
        onRemoved?.()
      } else {
        toast.error(result.message ?? 'Something went wrong.')
      }
    })
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger render={<Button size="sm" variant="ghost" className="text-muted-foreground" />}>
        Remove from queue
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove this question from review?</AlertDialogTitle>
          <AlertDialogDescription>
            This stops scheduled review for this question without testing you on it again — it will
            no longer count toward mastery the normal way (four correct retries in a row). Only do
            this if you are already confident with it.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep in queue</AlertDialogCancel>
          <AlertDialogAction disabled={isPending} loading={isPending} onClick={handleConfirm}>
            Remove
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
