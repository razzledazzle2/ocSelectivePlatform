'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { GraduationCapIcon } from 'lucide-react'
import { toast } from 'sonner'

import { setActiveProgramAction } from '@/lib/student-program/actions'
import { cn } from '@/lib/utils'
import type { ExamType } from '@/lib/types'

interface ProgramSwitcherProps {
  current: ExamType
  programs: ExamType[]
  /** 'sidebar' renders in the sidebar shell; 'header' is a compact light control. */
  variant?: 'sidebar' | 'header'
  className?: string
}

const PROGRAM_HINT: Record<ExamType, string> = {
  OC: 'Opportunity Class (Year 4)',
  Selective: 'Selective High School (Year 6)',
}

/**
 * Persistent OC/Selective switch. When a student only has one program it renders
 * a subtle label instead of an interactive control. Switching re-fetches the
 * program-scoped server data via `router.refresh()`.
 */
export function ProgramSwitcher({ current, programs, variant = 'header', className }: ProgramSwitcherProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const onSidebar = variant === 'sidebar'

  // Single-program students: a quiet label, no unnecessary control.
  if (programs.length < 2) {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium',
          onSidebar
            ? 'bg-sidebar-accent/40 text-sidebar-foreground/80'
            : 'bg-muted text-muted-foreground',
          className
        )}
      >
        <GraduationCapIcon className="size-3.5" aria-hidden />
        <span>{current} program</span>
      </span>
    )
  }

  function switchTo(program: ExamType) {
    if (program === current || isPending) return
    startTransition(async () => {
      const result = await setActiveProgramAction(program)
      if (!result.success) {
        toast.error(result.message ?? 'Could not switch program.')
        return
      }
      toast.success(`Switched to ${program} content`)
      router.refresh()
    })
  }

  return (
    <div
      role="group"
      aria-label="Active learning program"
      aria-busy={isPending}
      className={cn(
        'inline-flex items-center gap-0.5 rounded-xl p-0.5',
        onSidebar ? 'bg-sidebar-accent/40 ring-1 ring-sidebar-border' : 'border border-border bg-muted/60',
        isPending && 'opacity-70',
        className
      )}
    >
      {programs.map((program) => {
        const active = program === current
        return (
          <button
            key={program}
            type="button"
            onClick={() => switchTo(program)}
            disabled={isPending}
            aria-pressed={active}
            title={PROGRAM_HINT[program]}
            className={cn(
              'rounded-lg px-3 py-1 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand',
              active
                ? onSidebar
                  ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-sm'
                  : 'bg-card text-foreground shadow-sm ring-1 ring-border'
                : onSidebar
                  ? 'text-sidebar-foreground hover:text-sidebar-accent-foreground'
                  : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {program}
          </button>
        )
      })}
    </div>
  )
}
