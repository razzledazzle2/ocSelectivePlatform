import { QuestionAsset } from '@/components/questions/question-asset'
import { renderInlineMarkdown } from '@/components/questions/question-markdown'
import { cn } from '@/lib/utils'
import type { QuestionOptionRecord } from '@/lib/types'

interface QuestionOptionContentProps {
  option: QuestionOptionRecord
  className?: string
}

/**
 * Shared answer-option body: renders the option text (with inline bold/italic)
 * and/or its visual asset. Uses only <span> wrappers so it stays valid inside
 * the answer <button> elements every runner uses.
 */
export function QuestionOptionContent({ option, className }: QuestionOptionContentProps) {
  const text = option.option_text?.trim()

  return (
    <span className={cn('flex min-w-0 flex-1 flex-col gap-2', className)}>
      {text ? <span className="whitespace-normal leading-7">{renderInlineMarkdown(text)}</span> : null}
      {option.asset ? <QuestionAsset asset={option.asset} className="max-w-60" /> : null}
    </span>
  )
}
