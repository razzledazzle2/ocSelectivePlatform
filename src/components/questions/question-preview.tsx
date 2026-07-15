import { QuestionAsset } from '@/components/questions/question-asset'
import { QuestionMarkdown } from '@/components/questions/question-markdown'
import { QuestionOptionContent } from '@/components/questions/question-option-content'
import { StimulusPanel } from '@/components/questions/stimulus-panel'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  QUESTION_SET_TYPE_LABELS,
  SET_FEEDBACK_MODE_LABELS,
  readStimulusAttribution,
  type AnswerFormat,
  type AssetRecord,
  type MistakeQuestionDetail,
  type QuestionDetail,
  type QuestionOptionRecord,
  type QuestionSetMembership,
  type StudentAssetRef,
  type StudentStimulus,
  type WritingRubric,
} from '@/lib/types'

interface QuestionPreviewProps {
  question: QuestionDetail | MistakeQuestionDetail
  showStatus?: boolean
  showMistakeSummary?: boolean
  /** Show the student-facing "Select the correct answer." instruction line. */
  showInstruction?: boolean
  /** Hide the exam/subject/topic badge row when the surrounding UI already shows it. */
  showMeta?: boolean
  /**
   * `admin` keeps internal metadata (stimulus-type badge) visible; `student`
   * mirrors the student experience and hides it. Defaults to `student`.
   */
  audience?: 'admin' | 'student'
  /** Reading-set membership shown in the admin preview (never for students). */
  setMembership?: QuestionSetMembership | null
}

function getDifficultyLabel(difficulty: number | null | undefined): string {
  return difficulty ? `Difficulty ${difficulty}` : 'Difficulty unknown'
}

function isMistakeQuestion(
  question: QuestionDetail | MistakeQuestionDetail
): question is MistakeQuestionDetail {
  return 'timesIncorrect' in question
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

function getWorkedSolution(question: QuestionDetail | MistakeQuestionDetail): string | null {
  return 'worked_solution' in question ? question.worked_solution : question.workedSolution
}

function getCorrectOptionLabel(question: QuestionDetail | MistakeQuestionDetail) {
  return 'correct_option_label' in question ? question.correct_option_label : question.correctOptionLabel
}

function getAnswerFormat(question: QuestionDetail | MistakeQuestionDetail): AnswerFormat {
  // Mistake tracking is MCQ-only, so the detail shape has no answer format.
  return 'answer_format' in question ? question.answer_format : 'single_choice'
}

function getRubric(question: QuestionDetail | MistakeQuestionDetail): WritingRubric | null {
  return 'rubric' in question ? question.rubric : null
}

function toStudentAssetRef(asset: AssetRecord): StudentAssetRef {
  return {
    id: asset.id,
    assetType: asset.asset_type,
    externalRef: asset.external_ref,
    storagePath: asset.storage_path,
    externalUrl: asset.external_url,
    altText: asset.alt_text,
    status: asset.status,
  }
}

function getStimulus(question: QuestionDetail | MistakeQuestionDetail): StudentStimulus | null {
  if (isMistakeQuestion(question)) {
    return question.stimulus
  }

  if (!question.stimulus) {
    return null
  }

  // QuestionDetail carries the raw stimulus record (its assets are not linked
  // on this shape yet), so normalise it into the shared student stimulus form.
  return {
    id: question.stimulus.id,
    title: question.stimulus.title,
    stimulusType: question.stimulus.stimulus_type,
    bodyMarkdown: question.stimulus.body_markdown,
    assets: [],
    attribution: readStimulusAttribution(question.stimulus.source_info),
  }
}

/** Question-level provenance (source_name/paper/…) for the admin preview. */
function getQuestionSourceInfo(
  question: QuestionDetail | MistakeQuestionDetail
): Record<string, string> {
  if (isMistakeQuestion(question)) {
    return {}
  }
  const info = question.source_info ?? {}
  const entries: Array<[string, string]> = [
    ['Source', info.sourceName ?? ''],
    ['Paper', info.sourcePaper ?? ''],
    ['Section', info.sourceSection ?? ''],
    ['Question no.', info.sourceQuestionNumber ?? ''],
    ['Licence', info.licenseNotes ?? ''],
  ]
  return Object.fromEntries(entries.filter(([, value]) => value.trim())) as Record<string, string>
}

function getAssetsByRole(
  question: QuestionDetail | MistakeQuestionDetail,
  role: 'question' | 'solution'
): StudentAssetRef[] {
  if (isMistakeQuestion(question)) {
    return role === 'question' ? question.questionAssets : []
  }

  return question.assets
    .filter((link) => link.role === role)
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((link) => toStudentAssetRef(link.asset))
}

function RubricPreview({ rubric }: { rubric: WritingRubric }) {
  return (
    <div className="space-y-4">
      {rubric.textType ? (
        <p className="text-sm text-muted-foreground">
          Text type: <span className="font-medium text-foreground">{rubric.textType}</span>
        </p>
      ) : null}

      {rubric.criteria.length ? (
        <div className="overflow-hidden rounded-xl border border-border">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead className="px-3">Criterion</TableHead>
                <TableHead className="px-3">Description</TableHead>
                <TableHead className="px-3 text-right">Max marks</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rubric.criteria.map((criterion, index) => (
                <TableRow key={index}>
                  <TableCell className="whitespace-normal px-3 py-2 align-top font-medium">
                    {criterion.name}
                  </TableCell>
                  <TableCell className="whitespace-normal px-3 py-2 align-top text-foreground/80">
                    {criterion.description ?? '—'}
                  </TableCell>
                  <TableCell className="px-3 py-2 text-right align-top">{criterion.maxMarks}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : null}

      {rubric.scoreBands?.length ? (
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-foreground">Score bands</h4>
          <ul className="space-y-1.5 text-sm leading-6 text-foreground/80">
            {rubric.scoreBands.map((band, index) => (
              <li key={index}>
                <span className="font-medium text-foreground">{band.band}</span>
                {band.range ? ` (${band.range})` : ''}
                {band.descriptor ? ` — ${band.descriptor}` : ''}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {rubric.planningHints?.length ? (
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-foreground">Planning hints</h4>
          <ul className="list-disc space-y-1 pl-5 text-sm leading-6 text-foreground/80">
            {rubric.planningHints.map((hint, index) => (
              <li key={index}>{hint}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {rubric.sampleAnswerNotes ? (
        <div className="space-y-1">
          <h4 className="text-sm font-semibold text-foreground">Sample answer notes</h4>
          <p className="text-sm leading-6 text-foreground/80">{rubric.sampleAnswerNotes}</p>
        </div>
      ) : null}
    </div>
  )
}

export function QuestionPreview({
  question,
  showStatus = true,
  showMistakeSummary = false,
  showInstruction = false,
  showMeta = true,
  audience = 'student',
  setMembership = null,
}: QuestionPreviewProps) {
  const isAdmin = audience === 'admin'
  const answerFormat = getAnswerFormat(question)
  const isWritingPrompt = answerFormat === 'extended_response'
  const stimulus = getStimulus(question)
  const subjectName = getSubjectLabel(question)
  const isReading = (subjectName ?? '').toLowerCase().includes('reading')
  const questionAssets = getAssetsByRole(question, 'question')
  const solutionAssets = getAssetsByRole(question, 'solution')
  const rubric = getRubric(question)
  const sourceInfo = isAdmin ? getQuestionSourceInfo(question) : {}
  const sourceEntries = Object.entries(sourceInfo)
  // A sentence-insertion child keeps its options on the shared pool, so fall back
  // to the pool's options (with the correct one flagged) when the row has none.
  const displayOptions: QuestionOptionRecord[] =
    question.options.length > 0
      ? question.options
      : setMembership?.sharedOptionPool
        ? setMembership.sharedOptionPool.options.map((option, index) => ({
            label: option.label,
            option_text: option.text,
            sort_order: index + 1,
            asset: null,
          }))
        : []
  // Worked solution is the single authoritative explanation; fall back to any
  // legacy short explanation so pre-migration content is not lost.
  const solution = getWorkedSolution(question) || getShortExplanation(question)

  return (
    <Card className="rounded-2xl shadow-sm ring-border">
      <CardHeader className="space-y-4 border-b border-border/70">
        {showMeta ? (
          <div className="flex flex-wrap gap-2">
            {isWritingPrompt ? <Badge>Writing prompt</Badge> : null}
            {getExamType(question) ? <Badge variant="outline">{getExamType(question)}</Badge> : null}
            {getSubjectLabel(question) ? <Badge variant="secondary">{getSubjectLabel(question)}</Badge> : null}
            {getTopicLabel(question) ? <Badge variant="outline">{getTopicLabel(question)}</Badge> : null}
            {getQuestionTypeLabel(question) ? (
              <Badge variant="outline">{getQuestionTypeLabel(question)}</Badge>
            ) : null}
            <Badge variant="outline">{getDifficultyLabel(question.difficulty)}</Badge>
            {'status' in question && showStatus ? (
              <Badge variant={question.status === 'published' ? 'default' : 'outline'}>{question.status}</Badge>
            ) : null}
            {isAdmin && setMembership ? (
              <Badge variant="secondary">
                {QUESTION_SET_TYPE_LABELS[setMembership.setType]} · Q{setMembership.position}/
                {setMembership.totalItems}
              </Badge>
            ) : null}
          </div>
        ) : null}
        <div className="space-y-3">
          {/* Supporting stimulus renders BEFORE the prompt it supports. */}
          {stimulus ? (
            <StimulusPanel
              stimulus={stimulus}
              subjectName={subjectName}
              showTypeLabel={isAdmin}
              showSourceUrl={isAdmin}
            />
          ) : getPassageText(question) ? (
            <QuestionMarkdown
              text={getPassageText(question)}
              className={
                isReading
                  ? 'rounded-2xl border border-border bg-card px-5 py-5 text-base leading-8 text-foreground'
                  : 'rounded-xl border border-border bg-card px-4 py-4 text-base leading-7 text-foreground'
              }
            />
          ) : null}
          <CardTitle className="text-xl leading-relaxed">
            <QuestionMarkdown text={getQuestionText(question)} className="font-semibold" />
          </CardTitle>
          {showInstruction && !isWritingPrompt ? (
            <p className="text-sm text-muted-foreground">Select the correct answer.</p>
          ) : null}
          {questionAssets.length ? (
            <div className="space-y-3">
              {questionAssets.map((asset) => (
                <QuestionAsset key={asset.id} asset={asset} />
              ))}
            </div>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-6 pt-6">
        {isWritingPrompt ? (
          <div className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-brand">
              Marking rubric
            </h2>
            {rubric ? (
              <RubricPreview rubric={rubric} />
            ) : (
              <p className="text-sm text-muted-foreground">
                No rubric has been added for this writing prompt yet.
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-brand">
              {setMembership?.sharedOptionPool && question.options.length === 0
                ? 'Shared option bank'
                : 'Options'}
            </h2>
            <div className="grid gap-3">
              {displayOptions.map((option) => {
                const correctLabel = getCorrectOptionLabel(question)
                const isCorrect = correctLabel !== null && option.label === correctLabel

                return (
                  <div
                    key={option.label}
                    className={[
                      'rounded-2xl border px-4 py-3',
                      isCorrect
                        ? 'border-emerald-300 bg-emerald-50 text-emerald-900'
                        : 'border-border bg-card text-foreground/80',
                    ].join(' ')}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <span className="mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-white">
                          {option.label}
                        </span>
                        <QuestionOptionContent option={option} />
                      </div>
                      {isCorrect ? <Badge>Correct answer</Badge> : null}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        <div className="rounded-2xl border border-border bg-muted/50 px-4 py-4">
          <h3 className="text-sm font-semibold text-foreground">Solution</h3>
          {solution ? (
            <QuestionMarkdown text={solution} className="mt-2 text-base leading-7 text-foreground/90" />
          ) : (
            <p className="mt-2 text-sm leading-7 text-foreground/80">
              No solution has been added yet.
            </p>
          )}
          {solutionAssets.length ? (
            <div className="mt-3 space-y-3">
              {solutionAssets.map((asset) => (
                <QuestionAsset key={asset.id} asset={asset} />
              ))}
            </div>
          ) : null}
        </div>

        {isAdmin && setMembership ? (
          <div className="rounded-2xl border border-border bg-muted/40 px-4 py-4">
            <h3 className="text-sm font-semibold text-foreground">Reading set</h3>
            <dl className="mt-2 grid grid-cols-1 gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
              <SetDetail label="Set title" value={setMembership.title} />
              <SetDetail label="Set ID" value={setMembership.externalRef ?? '—'} />
              <SetDetail label="Type" value={QUESTION_SET_TYPE_LABELS[setMembership.setType]} />
              <SetDetail label="Feedback" value={SET_FEEDBACK_MODE_LABELS[setMembership.feedbackMode]} />
              <SetDetail
                label="Position"
                value={`${setMembership.position} of ${setMembership.totalItems}`}
              />
              {setMembership.targetLabel ? (
                <SetDetail label="Target gap" value={setMembership.targetLabel} />
              ) : null}
              {setMembership.sharedOptionPool ? (
                <SetDetail
                  label="Shared option pool"
                  value={`${setMembership.sharedOptionPool.externalRef ?? setMembership.sharedOptionPool.id} · ${setMembership.sharedOptionPool.options.length} options`}
                />
              ) : null}
            </dl>
          </div>
        ) : null}

        {isAdmin && sourceEntries.length ? (
          <div className="rounded-2xl border border-border bg-muted/40 px-4 py-4">
            <h3 className="text-sm font-semibold text-foreground">Question source</h3>
            <dl className="mt-2 grid grid-cols-1 gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
              {sourceEntries.map(([label, value]) => (
                <SetDetail key={label} label={label} value={value} />
              ))}
            </dl>
          </div>
        ) : null}

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

function SetDetail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-2">
      <dt className="shrink-0 text-muted-foreground">{label}:</dt>
      <dd className="min-w-0 break-words font-medium text-foreground">{value}</dd>
    </div>
  )
}
