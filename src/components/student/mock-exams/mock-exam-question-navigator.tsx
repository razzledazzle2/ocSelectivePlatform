'use client'

import { FlagIcon } from 'lucide-react'

import { cn } from '@/lib/utils'

export interface NavigatorItem {
  index: number
  answered: boolean
  flagged: boolean
}

interface MockExamQuestionNavigatorProps {
  items: NavigatorItem[]
  currentIndex: number
  onSelect: (index: number) => void
}

export function MockExamQuestionNavigator({
  items,
  currentIndex,
  onSelect,
}: MockExamQuestionNavigatorProps) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-6 gap-2 sm:grid-cols-8 lg:grid-cols-5">
        {items.map((item) => {
          const isCurrent = item.index === currentIndex
          return (
            <button
              key={item.index}
              type="button"
              onClick={() => onSelect(item.index)}
              aria-current={isCurrent ? 'true' : undefined}
              aria-label={`Question ${item.index + 1}${item.answered ? ', answered' : ''}${
                item.flagged ? ', flagged' : ''
              }`}
              className={cn(
                'relative flex h-9 items-center justify-center rounded-lg border text-sm font-medium transition-colors',
                'border-slate-200 bg-white text-slate-700 hover:border-slate-300',
                item.answered && 'border-slate-900 bg-slate-900 text-white hover:border-slate-900',
                isCurrent && 'ring-2 ring-cyan-500 ring-offset-1'
              )}
            >
              {item.index + 1}
              {item.flagged ? (
                <FlagIcon className="absolute -top-1.5 -right-1.5 size-3.5 fill-amber-400 text-amber-500" />
              ) : null}
            </button>
          )
        })}
      </div>
      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-3 rounded-sm border border-slate-900 bg-slate-900" />
          Answered
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-3 rounded-sm border border-slate-200 bg-white" />
          Unanswered
        </span>
        <span className="inline-flex items-center gap-1.5">
          <FlagIcon className="size-3 fill-amber-400 text-amber-500" />
          Flagged
        </span>
      </div>
    </div>
  )
}
