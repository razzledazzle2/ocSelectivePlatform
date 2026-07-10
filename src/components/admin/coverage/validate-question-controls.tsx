'use client'

import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { CircleCheckIcon } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { setValidationStatusAction } from '@/app/admin/coverage/actions'
import type { ValidationStatus } from '@/lib/types'

/** Inline validation sign-off control for one question in the subtopic detail list. */
export function ValidateQuestionControls({
  questionId,
  validationStatus,
}: {
  questionId: string
  validationStatus: string
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const set = (next: ValidationStatus) => {
    startTransition(async () => {
      const result = await setValidationStatusAction(questionId, next)
      if (!result.success) {
        toast.error(result.message ?? 'Unable to update.')
        return
      }
      toast.success(result.message ?? 'Updated.')
      router.refresh()
    })
  }

  if (validationStatus === 'validated') {
    return (
      <div className="flex items-center gap-1.5">
        <span className="inline-flex items-center gap-1 text-xs font-medium text-success">
          <CircleCheckIcon className="size-3.5" aria-hidden />
          Validated
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-xs"
          disabled={isPending}
          onClick={() => set('unreviewed')}
        >
          Undo
        </Button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-1.5">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-6 px-2 text-xs"
        disabled={isPending}
        onClick={() => set('validated')}
      >
        Validate
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className={cn(
          'h-6 px-2 text-xs',
          validationStatus === 'needs_fixes' && 'text-warning'
        )}
        disabled={isPending}
        onClick={() => set('needs_fixes')}
      >
        {validationStatus === 'needs_fixes' ? 'Needs fixes' : 'Flag'}
      </Button>
    </div>
  )
}
