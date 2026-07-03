'use client'

import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import {
  ArchiveIcon,
  CheckCircle2Icon,
  EyeIcon,
  MoreHorizontalIcon,
  RotateCcwIcon,
  UserPlusIcon,
  XCircleIcon,
} from 'lucide-react'
import { toast } from 'sonner'

import {
  archiveReportedQuestionAction,
  assignReportAction,
  updateReportStatusAction,
} from '@/app/admin/reports/actions'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { ActionResult, ReportStatus, ReviewerOption } from '@/lib/types'

interface ReportActionsMenuProps {
  reportId: string
  questionId: string
  status: ReportStatus
  reviewers: ReviewerOption[]
}

export function ReportActionsMenu({ reportId, questionId, status, reviewers }: ReportActionsMenuProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  function runAction(action: () => Promise<ActionResult>) {
    startTransition(async () => {
      const result = await action()
      if (result.success) {
        toast.success(result.message ?? 'Done.')
        router.refresh()
      } else {
        toast.error(result.message ?? 'Something went wrong.')
      }
    })
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button type="button" variant="outline" size="icon-sm" disabled={isPending} />}
      >
        <MoreHorizontalIcon className="size-4" />
        <span className="sr-only">Report actions</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuLabel>Triage</DropdownMenuLabel>
        {status !== 'in_review' ? (
          <DropdownMenuItem onClick={() => runAction(() => updateReportStatusAction(reportId, 'in_review'))}>
            <EyeIcon />
            Mark in review
          </DropdownMenuItem>
        ) : null}
        {status !== 'resolved' ? (
          <DropdownMenuItem onClick={() => runAction(() => updateReportStatusAction(reportId, 'resolved'))}>
            <CheckCircle2Icon />
            Mark resolved
          </DropdownMenuItem>
        ) : null}
        {status !== 'dismissed' ? (
          <DropdownMenuItem onClick={() => runAction(() => updateReportStatusAction(reportId, 'dismissed'))}>
            <XCircleIcon />
            Dismiss
          </DropdownMenuItem>
        ) : null}
        {status !== 'open' ? (
          <DropdownMenuItem onClick={() => runAction(() => updateReportStatusAction(reportId, 'open'))}>
            <RotateCcwIcon />
            Reopen
          </DropdownMenuItem>
        ) : null}

        <DropdownMenuSeparator />
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <UserPlusIcon />
            Assign to
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="max-h-64 w-56 overflow-y-auto">
            {reviewers.length === 0 ? (
              <DropdownMenuItem disabled>No reviewers available</DropdownMenuItem>
            ) : (
              reviewers.map((reviewer) => (
                <DropdownMenuItem
                  key={reviewer.id}
                  onClick={() => runAction(() => assignReportAction(reportId, reviewer.id))}
                >
                  {reviewer.name}
                </DropdownMenuItem>
              ))
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => runAction(() => assignReportAction(reportId, null))}>
              Unassign
            </DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          onClick={() => runAction(() => archiveReportedQuestionAction(questionId))}
        >
          <ArchiveIcon />
          Archive question
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
