'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { BookOpenIcon, ClockIcon, LayersIcon } from 'lucide-react'
import { toast } from 'sonner'

import { startReadingPracticeAction } from '@/app/student/practice/reading/actions'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { ExamType, ReadingPracticeChoice } from '@/lib/types'

interface ReadingPracticeSetupProps {
  examType: ExamType
  subjectId: string
  choices: ReadingPracticeChoice[]
}

export function ReadingPracticeSetup({ examType, subjectId, choices }: ReadingPracticeSetupProps) {
  const router = useRouter()
  const [selectedKey, setSelectedKey] = useState<string>(choices[0]?.key ?? '')
  const [isPending, startTransition] = useTransition()

  const start = () => {
    const choice = choices.find((option) => option.key === selectedKey)
    if (!choice) return

    startTransition(async () => {
      const formData = new FormData()
      formData.set('examType', examType)
      formData.set('subjectId', subjectId)
      formData.set('setCount', String(choice.setCount))
      const result = await startReadingPracticeAction(formData)
      if (!result.success || !result.data) {
        toast.error(result.message ?? 'Unable to start reading practice.')
        return
      }
      router.push(`/student/practice/reading/${result.data.sessionId}`)
    })
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-3" role="radiogroup" aria-label="How much reading practice">
        {choices.map((choice) => {
          const isSelected = choice.key === selectedKey
          return (
            <button
              key={choice.key}
              type="button"
              role="radio"
              aria-checked={isSelected}
              onClick={() => setSelectedKey(choice.key)}
              className={cn(
                'flex items-center gap-4 rounded-2xl border px-5 py-4 text-left transition-colors',
                'border-border bg-card hover:bg-muted/50',
                isSelected && 'border-brand bg-brand-soft'
              )}
            >
              <span
                className={cn(
                  'flex size-10 shrink-0 items-center justify-center rounded-full',
                  isSelected ? 'bg-brand text-brand-foreground' : 'bg-muted text-muted-foreground'
                )}
              >
                <LayersIcon className="size-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold text-foreground">{choice.label}</span>
                <span className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <BookOpenIcon className="size-4" /> ~{choice.estimatedQuestions} question
                    {choice.estimatedQuestions === 1 ? '' : 's'}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <ClockIcon className="size-4" /> ~{choice.estimatedMinutes} min
                  </span>
                </span>
              </span>
            </button>
          )
        })}
      </div>

      <Card className="border-dashed">
        <CardContent className="py-3 text-xs text-muted-foreground">
          Each passage set is practised whole — you answer every question, then submit to see your results and
          worked solutions together.
        </CardContent>
      </Card>

      <Button onClick={start} loading={isPending} disabled={isPending || !selectedKey}>
        Start reading practice
      </Button>
    </div>
  )
}
