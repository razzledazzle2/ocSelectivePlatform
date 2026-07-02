'use client'

import { useState } from 'react'
import { EyeIcon } from 'lucide-react'

import { getQuestionPreviewAction } from '@/app/admin/questions/actions'
import { QuestionPreview } from '@/components/questions/question-preview'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import type { QuestionDetail } from '@/lib/types'

interface QuestionPreviewDialogProps {
  questionId: string
}

export function QuestionPreviewDialog({ questionId }: QuestionPreviewDialogProps) {
  const [open, setOpen] = useState(false)
  const [question, setQuestion] = useState<QuestionDetail | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen)

    if (!nextOpen || question) {
      return
    }

    setIsLoading(true)
    setError(null)
    const result = await getQuestionPreviewAction(questionId)
    setIsLoading(false)

    if (result.success && result.data) {
      setQuestion(result.data)
    } else {
      setError(result.message ?? 'Unable to load the question preview.')
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={<Button variant="ghost" size="sm" />}>
        <EyeIcon className="size-3.5" />
        Preview
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Student preview</DialogTitle>
          <DialogDescription>
            This is how the question, options and worked solution appear to a student.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-6 w-2/3" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : null}

        {error ? (
          <Alert variant="destructive">
            <AlertTitle>Preview unavailable</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        {!isLoading && !error && question ? <QuestionPreview question={question} /> : null}
      </DialogContent>
    </Dialog>
  )
}
