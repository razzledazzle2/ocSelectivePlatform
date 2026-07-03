'use client'

import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { CopyIcon, MoreHorizontalIcon, SparklesIcon } from 'lucide-react'
import { toast } from 'sonner'

import { createSimilarQuestionAction, duplicateQuestionAction } from '@/app/admin/questions/actions'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { ActionResult } from '@/lib/types'

interface QuestionDuplicateActionsProps {
  questionId: string
}

export function QuestionDuplicateActions({ questionId }: QuestionDuplicateActionsProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  function runAction(action: () => Promise<ActionResult<{ redirectTo: string }>>) {
    startTransition(async () => {
      const result = await action()
      if (result.success && result.data?.redirectTo) {
        toast.success(result.message ?? 'Draft created.')
        router.push(result.data.redirectTo)
        router.refresh()
      } else {
        toast.error(result.message ?? 'Something went wrong.')
      }
    })
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" disabled={isPending} />}>
        <MoreHorizontalIcon className="size-4" />
        <span className="sr-only">More actions</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => runAction(() => duplicateQuestionAction(questionId))}>
          <CopyIcon className="size-4" />
          Duplicate
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => runAction(() => createSimilarQuestionAction(questionId))}>
          <SparklesIcon className="size-4" />
          Create similar
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
