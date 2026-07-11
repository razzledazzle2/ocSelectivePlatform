'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { SparklesIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import type { ButtonSize, ButtonVariant } from '@/components/ui/button'
import type { ExamType } from '@/lib/types'

const SESSION_LENGTHS = [5, 10, 20] as const
type SessionLength = (typeof SESSION_LENGTHS)[number]

interface PracticeSessionSheetProps {
  subtopicCode: string
  subtopicLabel: string
  examType: ExamType
  availableQuestions: number
  /** Where the runner returns to when the student backs out or finishes. */
  backHref?: string
  triggerLabel?: string
  triggerVariant?: ButtonVariant
  triggerSize?: ButtonSize
  triggerClassName?: string
}

/**
 * Compact launcher: pick a session length, then start targeted practice for one
 * subtopic. The set itself is built by the engine (varied skills/patterns, holds
 * back recently-seen questions, adapts difficulty), so length is the only choice
 * — no fake controls.
 */
export function PracticeSessionSheet({
  subtopicCode,
  subtopicLabel,
  examType,
  availableQuestions,
  backHref = '/student/practice',
  triggerLabel = 'Practise',
  triggerVariant = 'default',
  triggerSize = 'sm',
  triggerClassName,
}: PracticeSessionSheetProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [length, setLength] = useState<SessionLength>(10)
  const [isPending, startTransition] = useTransition()

  const maxLength = Math.min(availableQuestions, 20)

  function start() {
    const params = new URLSearchParams({
      subtopicCode,
      examType,
      count: String(Math.min(length, availableQuestions)),
      back: backHref,
    })
    startTransition(() => {
      router.push(`/student/practice/session?${params.toString()}`)
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant={triggerVariant} size={triggerSize} className={triggerClassName} />
        }
      >
        {triggerLabel}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Practise {subtopicLabel}</DialogTitle>
          <DialogDescription>
            {examType} · {availableQuestions} question{availableQuestions === 1 ? '' : 's'} ready. We build a
            varied set for you and hold back anything you have just seen.
          </DialogDescription>
        </DialogHeader>

        <fieldset className="space-y-2">
          <legend className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            How many questions?
          </legend>
          <div className="flex gap-2" role="radiogroup" aria-label="Session length">
            {SESSION_LENGTHS.map((value) => {
              const disabled = value > maxLength && value !== SESSION_LENGTHS[0]
              const selected = length === value
              return (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  disabled={disabled}
                  onClick={() => setLength(value)}
                  className={cn(
                    'flex-1 rounded-xl border px-3 py-3 text-center text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand',
                    selected
                      ? 'border-brand bg-brand-soft text-foreground'
                      : 'border-border bg-card text-foreground hover:bg-muted/50',
                    disabled && 'cursor-not-allowed opacity-40 hover:bg-card'
                  )}
                >
                  {value}
                  <span className="mt-0.5 block text-[0.65rem] font-normal text-muted-foreground">
                    questions
                  </span>
                </button>
              )
            })}
          </div>
          {availableQuestions < 10 ? (
            <p className="text-xs text-muted-foreground">
              Only {availableQuestions} ready here — your set may be shorter than requested.
            </p>
          ) : null}
        </fieldset>

        <Button className="w-full" loading={isPending} disabled={isPending} onClick={start}>
          <SparklesIcon className="size-4" />
          {isPending ? 'Starting…' : 'Start practice'}
        </Button>
      </DialogContent>
    </Dialog>
  )
}
