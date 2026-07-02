import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { MistakeQuestionDetail, QuestionDetail } from '@/lib/types'

interface QuestionPreviewProps {
  question: QuestionDetail | MistakeQuestionDetail
  showStatus?: boolean
  showMistakeSummary?: boolean
}

function getDifficultyLabel(difficulty: number | null | undefined): string {
  return difficulty ? `Difficulty ${difficulty}` : 'Difficulty unknown'
}

function getExamType(question: QuestionDetail | MistakeQuestionDetail) {
  return 'exam_type' in question ? question.exam_type : question.examType
}

function getSubjectLabel(question: QuestionDetail | MistakeQuestionDetail) {
  return 'subject' in question ? question.subject.name : question.subjectName
}

function getTopicLabel(question: QuestionDetail | MistakeQuestionDetail) {
  return 'topic' in question ? question.topic.name : question.topicName
}

function getQuestionTypeLabel(question: QuestionDetail | MistakeQuestionDetail) {
  return 'questionType' in question ? question.questionType?.name ?? null : question.questionTypeName
}

function getQuestionText(question: QuestionDetail | MistakeQuestionDetail) {
  return 'question_text' in question ? question.question_text : question.questionText
}

function getPassageText(question: QuestionDetail | MistakeQuestionDetail) {
  return 'passage_text' in question ? question.passage_text : question.passageText
}

function getShortExplanation(question: QuestionDetail | MistakeQuestionDetail) {
  return 'short_explanation' in question ? question.short_explanation : question.shortExplanation
}

function getWorkedSolution(question: QuestionDetail | MistakeQuestionDetail) {
  return 'worked_solution' in question ? question.worked_solution : question.workedSolution
}

function getCorrectOptionLabel(question: QuestionDetail | MistakeQuestionDetail) {
  return 'correct_option_label' in question ? question.correct_option_label : question.correctOptionLabel
}

function isMistakeQuestion(question: QuestionDetail | MistakeQuestionDetail): question is MistakeQuestionDetail {
  return 'timesIncorrect' in question
}

export function QuestionPreview({
  question,
  showStatus = true,
  showMistakeSummary = false,
}: QuestionPreviewProps) {
  return (
    <Card className="border-white/70 bg-white/94 shadow-lg shadow-slate-200/50">
      <CardHeader className="space-y-4 border-b border-border/70">
        <div className="flex flex-wrap gap-2">
          {getExamType(question) ? <Badge variant="outline">{getExamType(question)}</Badge> : null}
          {getSubjectLabel(question) ? <Badge variant="secondary">{getSubjectLabel(question)}</Badge> : null}
          {getTopicLabel(question) ? <Badge variant="outline">{getTopicLabel(question)}</Badge> : null}
          {getQuestionTypeLabel(question) ? <Badge variant="outline">{getQuestionTypeLabel(question)}</Badge> : null}
          <Badge variant="outline">{getDifficultyLabel(question.difficulty)}</Badge>
          {'status' in question && showStatus ? (
            <Badge variant={question.status === 'published' ? 'default' : 'outline'}>{question.status}</Badge>
          ) : null}
        </div>
        <div className="space-y-2">
          <CardTitle className="text-xl leading-relaxed">{getQuestionText(question)}</CardTitle>
          {getPassageText(question) ? (
            <CardDescription className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-7 text-slate-700">
              {getPassageText(question)}
            </CardDescription>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-6 pt-6">
        <div className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-700">Options</h2>
          <div className="grid gap-3">
            {question.options.map((option) => {
              const isCorrect = option.label === getCorrectOptionLabel(question)

              return (
                <div
                  key={option.label}
                  className={[
                    'rounded-2xl border px-4 py-3',
                    isCorrect
                      ? 'border-emerald-300 bg-emerald-50 text-emerald-900'
                      : 'border-slate-200 bg-white text-slate-700',
                  ].join(' ')}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <span className="mt-0.5 inline-flex size-7 items-center justify-center rounded-full bg-slate-950 text-xs font-semibold text-white">
                        {option.label}
                      </span>
                      <p className="leading-7">{option.option_text}</p>
                    </div>
                    {isCorrect ? <Badge>Correct answer</Badge> : null}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
            <h3 className="text-sm font-semibold text-slate-950">Short explanation</h3>
            <p className="mt-2 text-sm leading-7 text-slate-700">
              {getShortExplanation(question) ?? 'No short explanation has been added yet.'}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
            <h3 className="text-sm font-semibold text-slate-950">Worked solution</h3>
            <p className="mt-2 text-sm leading-7 text-slate-700">{getWorkedSolution(question)}</p>
          </div>
        </div>

        {showMistakeSummary && isMistakeQuestion(question) ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4">
            <h3 className="text-sm font-semibold text-amber-950">Mistake history</h3>
            <p className="mt-2 text-sm text-amber-900">
              This question has been answered incorrectly {question.timesIncorrect} time
              {question.timesIncorrect === 1 ? '' : 's'}. Correct answers after the mistake:{' '}
              {question.timesCorrectAfterMistake}.
            </p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
