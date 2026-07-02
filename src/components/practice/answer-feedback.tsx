import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { AttemptFeedback } from '@/lib/types'

interface AnswerFeedbackProps {
  feedback: AttemptFeedback
}

export function AnswerFeedback({ feedback }: AnswerFeedbackProps) {
  return (
    <Card
      className={[
        'border shadow-sm',
        feedback.isCorrect
          ? 'border-emerald-200 bg-emerald-50/80 shadow-emerald-100/60'
          : 'border-amber-200 bg-amber-50/80 shadow-amber-100/60',
      ].join(' ')}
    >
      <CardHeader className="border-b border-current/10">
        <div className="flex items-center gap-3">
          <Badge variant={feedback.isCorrect ? 'default' : 'destructive'}>
            {feedback.isCorrect ? 'Correct' : 'Incorrect'}
          </Badge>
          <CardTitle className="text-base">
            Correct answer: {feedback.correctOptionLabel}
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pt-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-950">Short explanation</h3>
          <p className="mt-2 text-sm leading-7 text-slate-700">
            {feedback.shortExplanation ?? 'No short explanation was added for this question yet.'}
          </p>
        </div>
        <div>
          <h3 className="text-sm font-semibold text-slate-950">Worked solution</h3>
          <p className="mt-2 text-sm leading-7 text-slate-700">{feedback.workedSolution}</p>
        </div>
      </CardContent>
    </Card>
  )
}
