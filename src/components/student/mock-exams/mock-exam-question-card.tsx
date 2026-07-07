'use client'

import { FlagIcon } from 'lucide-react'

import { QuestionAsset } from '@/components/questions/question-asset'
import { QuestionMarkdown } from '@/components/questions/question-markdown'
import { QuestionOptionContent } from '@/components/questions/question-option-content'
import { StimulusPanel } from '@/components/questions/stimulus-panel'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { MockExamRunnerQuestion } from '@/lib/mock-exams/types'
import type { QuestionOptionLabel } from '@/lib/types'

interface MockExamQuestionCardProps {
  question: MockExamRunnerQuestion
  questionNumber: number
  totalQuestions: number
  selectedLabel: QuestionOptionLabel | null
  isFlagged: boolean
  onSelect: (label: QuestionOptionLabel) => void
  onToggleFlag: () => void
}

export function MockExamQuestionCard({
  question,
  questionNumber,
  totalQuestions,
  selectedLabel,
  isFlagged,
  onSelect,
  onToggleFlag,
}: MockExamQuestionCardProps) {
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">
            Question {questionNumber} of {totalQuestions}
          </p>
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">{question.subjectName}</Badge>
            <Badge variant="outline">{question.topicName}</Badge>
            {question.questionTypeName ? (
              <Badge variant="outline">{question.questionTypeName}</Badge>
            ) : null}
          </div>
        </div>
        <Button
          type="button"
          variant={isFlagged ? 'default' : 'outline'}
          size="sm"
          onClick={onToggleFlag}
          aria-pressed={isFlagged}
        >
          <FlagIcon className={cn('size-4', isFlagged && 'fill-current')} />
          {isFlagged ? 'Flagged' : 'Flag'}
        </Button>
      </div>

      <div className="space-y-4">
        {question.stimulus ? (
          <StimulusPanel stimulus={question.stimulus} />
        ) : question.passageText ? (
          <div className="rounded-2xl border border-border bg-muted/50 px-4 py-4 text-sm leading-7 text-foreground/80">
            {question.passageText}
          </div>
        ) : null}
        <QuestionMarkdown text={question.questionText} className="text-lg leading-8 text-foreground" />
        {question.questionAssets.length ? (
          <div className="space-y-3">
            {question.questionAssets.map((asset) => (
              <QuestionAsset key={asset.id} asset={asset} />
            ))}
          </div>
        ) : null}
      </div>

      <div className="grid gap-3">
        {question.options.map((option) => {
          const isSelected = selectedLabel === option.label
          return (
            <button
              key={option.label}
              type="button"
              aria-pressed={isSelected}
              onClick={() => onSelect(option.label as QuestionOptionLabel)}
              className={cn(
                'flex w-full items-start gap-3 rounded-2xl border px-4 py-4 text-left transition-colors',
                'border-border bg-white hover:bg-muted/50',
                isSelected && 'border-brand bg-brand-soft text-foreground'
              )}
            >
              <span
                className={cn(
                  'inline-flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
                  isSelected ? 'bg-brand text-brand-foreground' : 'bg-primary text-primary-foreground'
                )}
              >
                {option.label}
              </span>
              <QuestionOptionContent option={option} />
            </button>
          )
        })}
      </div>
    </div>
  )
}
