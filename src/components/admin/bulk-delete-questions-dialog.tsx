'use client'

import { useEffect, useState, useTransition } from 'react'
import { AlertTriangleIcon, Loader2Icon } from 'lucide-react'

import { bulkHardDeleteQuestionsAction, previewHardDeleteQuestionsAction } from '@/app/admin/questions/bulk-actions'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Input } from '@/components/ui/input'
import type { BulkQuestionMutationResult, BulkQuestionSelectionInput, HardDeletePreview } from '@/lib/types'

/** Above this many eligible questions, the admin must type a literal "DELETE N QUESTIONS" to confirm. */
const TYPED_CONFIRMATION_THRESHOLD = 25

interface BulkDeleteQuestionsDialogProps {
  /** Non-null opens the dialog and starts loading a fresh, server-authoritative preview for this selection. */
  selection: BulkQuestionSelectionInput | null
  /** Human-readable description of what the selection is, e.g. "12 selected rows" or "347 questions matching filters". */
  selectionDescription: string
  onOpenChange: (open: boolean) => void
  onCompleted: (result: BulkQuestionMutationResult) => void
}

/**
 * Server-authoritative permanent-delete confirmation. The preview
 * (eligible/blocked/missing) and the final delete both re-resolve the
 * selection independently — the dialog never assumes the preview it fetched a
 * few seconds ago is still exactly true, which is also why the RPC itself
 * rechecks eligibility atomically at delete time (see the migration).
 */
export function BulkDeleteQuestionsDialog({
  selection,
  selectionDescription,
  onOpenChange,
  onCompleted,
}: BulkDeleteQuestionsDialogProps) {
  const [preview, setPreview] = useState<HardDeletePreview | null>(null)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [isLoadingPreview, startPreviewLoad] = useTransition()
  const [isDeleting, startDelete] = useTransition()
  const [confirmationText, setConfirmationText] = useState('')

  useEffect(() => {
    setPreview(null)
    setPreviewError(null)
    setConfirmationText('')
    if (!selection) {
      return
    }
    startPreviewLoad(async () => {
      const result = await previewHardDeleteQuestionsAction(selection)
      if (result.success && result.data) {
        setPreview(result.data)
      } else {
        setPreviewError(result.message ?? 'Unable to preview this deletion.')
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selection])

  const eligibleCount = preview?.eligibleIds.length ?? 0
  const blockedCount = preview?.blocked.length ?? 0
  const missingCount = preview?.missingIds.length ?? 0
  const needsTypedConfirmation = eligibleCount > TYPED_CONFIRMATION_THRESHOLD
  const expectedConfirmationText = `DELETE ${eligibleCount} QUESTIONS`
  const canConfirm =
    Boolean(preview) &&
    eligibleCount > 0 &&
    !isDeleting &&
    (!needsTypedConfirmation || confirmationText.trim() === expectedConfirmationText)

  function handleConfirm() {
    if (!selection || !canConfirm) {
      return
    }
    startDelete(async () => {
      const result = await bulkHardDeleteQuestionsAction(selection)
      if (result.data) {
        onCompleted(result.data)
      }
      onOpenChange(false)
    })
  }

  const blockedReasonSample = (preview?.blocked ?? []).slice(0, 5)
  const blockedReasonOverflow = blockedCount - blockedReasonSample.length

  return (
    <AlertDialog open={selection !== null} onOpenChange={(open) => !open && !isDeleting && onOpenChange(open)}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle>Permanently delete questions?</AlertDialogTitle>
          <AlertDialogDescription>
            This cannot be undone. Selection: {selectionDescription}.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {isLoadingPreview ? (
          <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
            <Loader2Icon className="size-4 animate-spin" aria-hidden />
            Checking which questions are eligible for permanent deletion…
          </div>
        ) : previewError ? (
          <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            <AlertTriangleIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
            {previewError}
          </div>
        ) : preview ? (
          <div className="space-y-3 text-sm">
            <dl className="grid grid-cols-3 gap-2 rounded-lg border border-border bg-muted/30 p-3 text-center">
              <div>
                <dt className="text-xs text-muted-foreground">Selected</dt>
                <dd className="text-base font-semibold text-foreground">{preview.requestedCount}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Eligible</dt>
                <dd className="text-base font-semibold text-success">{eligibleCount}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Blocked</dt>
                <dd className="text-base font-semibold text-warning">{blockedCount + missingCount}</dd>
              </div>
            </dl>

            {blockedCount > 0 ? (
              <div className="rounded-lg border border-warning/30 bg-warning/5 p-3">
                <p className="font-medium text-foreground">
                  {blockedCount} question{blockedCount === 1 ? ' is' : 's are'} kept safe and will not be deleted:
                </p>
                <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs text-muted-foreground">
                  {blockedReasonSample.map((entry) => (
                    <li key={entry.questionId}>{entry.reason}</li>
                  ))}
                  {blockedReasonOverflow > 0 ? <li>and {blockedReasonOverflow} more with student history.</li> : null}
                </ul>
              </div>
            ) : null}

            {missingCount > 0 ? (
              <p className="text-xs text-muted-foreground">
                {missingCount} question{missingCount === 1 ? '' : 's'} could not be found (already removed elsewhere).
              </p>
            ) : null}

            {eligibleCount > 0 ? (
              <div className="space-y-1 text-xs text-muted-foreground">
                <p>
                  Deleting will remove the {eligibleCount === 1 ? 'question' : `${eligibleCount} questions`}, their
                  answer options and question-asset links.
                </p>
                <p>
                  Diagrams or images used only by these questions will be cleaned up; any still shared with another
                  question, answer option or stimulus are kept.
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">None of the selected questions are eligible for permanent deletion.</p>
            )}

            {needsTypedConfirmation && eligibleCount > 0 ? (
              <div className="space-y-1.5">
                <label htmlFor="bulk-delete-confirm-text" className="text-xs font-medium text-foreground">
                  Type <span className="font-mono">{expectedConfirmationText}</span> to confirm
                </label>
                <Input
                  id="bulk-delete-confirm-text"
                  value={confirmationText}
                  onChange={(event) => setConfirmationText(event.target.value)}
                  placeholder={expectedConfirmationText}
                  autoComplete="off"
                  aria-describedby="bulk-delete-confirm-hint"
                />
                <p id="bulk-delete-confirm-hint" className="text-xs text-muted-foreground">
                  Required for deletions of more than {TYPED_CONFIRMATION_THRESHOLD} questions.
                </p>
              </div>
            ) : null}
          </div>
        ) : null}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={handleConfirm}
            disabled={!canConfirm}
            aria-describedby={needsTypedConfirmation && eligibleCount > 0 ? 'bulk-delete-confirm-hint' : undefined}
          >
            {isDeleting ? (
              <>
                <Loader2Icon className="size-4 animate-spin" aria-hidden />
                Deleting…
              </>
            ) : eligibleCount > 0 ? (
              `Delete ${eligibleCount} forever`
            ) : (
              'Nothing eligible'
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
