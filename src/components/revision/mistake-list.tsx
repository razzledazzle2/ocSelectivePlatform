import Link from 'next/link'

import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { StudentMistakeQuestion } from '@/lib/types'

interface MistakeListProps {
  mistakes: StudentMistakeQuestion[]
}

const dateFormatter = new Intl.DateTimeFormat('en-AU', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
})

export function MistakeList({ mistakes }: MistakeListProps) {
  return (
    <Card className="border-white/70 bg-white/94 shadow-lg shadow-slate-200/50">
      <CardHeader className="border-b border-border/70">
        <CardTitle>Recent incorrect questions</CardTitle>
        <CardDescription>
          Smart Revision with spaced repetition will be added in Phase 3. For now, this page shows questions you have answered incorrectly.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 pt-6">
        {mistakes.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No mistake questions have been tracked yet. Once you miss a question in practice, it will show up here.
          </p>
        ) : (
          mistakes.map((mistake) => (
            <div
              key={mistake.id}
              className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4"
            >
              <div className="flex flex-wrap items-center gap-2">
                {mistake.subjectName ? <Badge variant="secondary">{mistake.subjectName}</Badge> : null}
                {mistake.topicName ? <Badge variant="outline">{mistake.topicName}</Badge> : null}
                {mistake.questionTypeName ? <Badge variant="outline">{mistake.questionTypeName}</Badge> : null}
                <Badge variant="destructive">Incorrect {mistake.timesIncorrect}x</Badge>
                <Badge variant="outline">{mistake.status.replace('_', ' ')}</Badge>
              </div>
              <p className="mt-3 text-sm leading-7 text-slate-700">{mistake.questionText}</p>
              <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                <p>Last incorrect: {dateFormatter.format(new Date(mistake.lastIncorrectAt))}</p>
                <p>Correct after mistake: {mistake.timesCorrectAfterMistake}</p>
              </div>
              <Link
                href={`/student/revision/${mistake.questionId}`}
                className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'mt-4')}
              >
                View question and solution
              </Link>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  )
}
