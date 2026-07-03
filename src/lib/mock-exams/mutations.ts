import { createClient } from '@/lib/supabase/server'
import { upsertMistakeQuestion } from '@/lib/practice/mutations'
import { MOCK_EXAM_CONFIGS, resolveExamType, type MockExamType } from '@/lib/mock-exams/config'
import { selectMockExamQuestions } from '@/lib/mock-exams/queries'
import type { ExamType, QuestionOptionLabel } from '@/lib/types'

interface CreateMockExamInput {
  studentId: string
  mockType: MockExamType
  chosenExamType: ExamType
  subjectId: string | null
}

interface CreateMockExamResult {
  sessionId: string
  totalQuestions: number
}

/**
 * Creates a mock exam session with a fixed, randomised question order. The timer starts now
 * (started_at defaults to now()), so this is only called when the student chooses to begin.
 * Returns null when no published questions are available for the configuration.
 */
export async function createMockExamSession(
  input: CreateMockExamInput
): Promise<CreateMockExamResult | null> {
  const config = MOCK_EXAM_CONFIGS[input.mockType]
  const examType = resolveExamType(config, input.chosenExamType)
  const subjectId = config.requiresSubject ? input.subjectId : null

  const selected = await selectMockExamQuestions(input.mockType, input.chosenExamType, subjectId)

  if (!selected.length) {
    return null
  }

  const supabase = await createClient()
  const { data: session, error: sessionError } = await supabase
    .from('mock_exam_sessions')
    .insert({
      student_id: input.studentId,
      mock_type: input.mockType,
      exam_type: examType,
      subject_id: subjectId,
      status: 'in_progress',
      time_limit_seconds: config.timeLimitSeconds,
      total_questions: selected.length,
    })
    .select('id')
    .single()

  if (sessionError || !session) {
    throw new Error('Unable to start this mock exam.')
  }

  const rows = selected.map((question, index) => ({
    session_id: session.id,
    question_id: question.questionId,
    question_order: index + 1,
    is_flagged: false,
  }))

  const { error: questionsError } = await supabase
    .from('mock_exam_session_questions')
    .insert(rows)

  if (questionsError) {
    throw new Error('Unable to prepare the questions for this mock exam.')
  }

  return { sessionId: session.id, totalQuestions: selected.length }
}

interface SaveMockAnswerInput {
  sessionId: string
  studentId: string
  questionId: string
  selectedOptionLabel?: QuestionOptionLabel | null
  isFlagged?: boolean
  timeSpentSeconds?: number
}

/**
 * Persists answer/flag state for one question as the student progresses, so a page refresh keeps
 * their work. Only touches sessions the student owns and that are still in progress.
 */
export async function saveMockAnswer(input: SaveMockAnswerInput): Promise<void> {
  const supabase = await createClient()

  const { data: session, error: sessionError } = await supabase
    .from('mock_exam_sessions')
    .select('id, status')
    .eq('id', input.sessionId)
    .eq('student_id', input.studentId)
    .maybeSingle()

  if (sessionError) {
    throw new Error('Unable to save your progress.')
  }

  if (!session || session.status !== 'in_progress') {
    // Nothing to update on a missing or already-submitted session.
    return
  }

  const update: Record<string, unknown> = {}

  if (input.selectedOptionLabel !== undefined) {
    update.selected_option_label = input.selectedOptionLabel
    update.answered_at = input.selectedOptionLabel ? new Date().toISOString() : null
    if (typeof input.timeSpentSeconds === 'number') {
      update.time_spent_seconds = Math.max(0, Math.round(input.timeSpentSeconds))
    }
  }

  if (input.isFlagged !== undefined) {
    update.is_flagged = input.isFlagged
  }

  if (!Object.keys(update).length) {
    return
  }

  const { error: updateError } = await supabase
    .from('mock_exam_session_questions')
    .update(update)
    .eq('session_id', input.sessionId)
    .eq('question_id', input.questionId)

  if (updateError) {
    throw new Error('Unable to save your progress.')
  }
}

interface SubmitMockExamResult {
  sessionId: string
  totalQuestions: number
  correctCount: number
  incorrectCount: number
  unansweredCount: number
  accuracy: number
}

/**
 * Grades and finalises a mock exam. Recomputes everything server-side from the saved answers
 * (never trusting client totals): writes answered questions into question_attempts (mode 'mock'),
 * routes every missed question into Smart Revision, and stores session totals. Idempotent — a
 * session that is not in progress is returned as-is.
 */
export async function submitMockExam(
  sessionId: string,
  studentId: string
): Promise<SubmitMockExamResult | null> {
  const supabase = await createClient()

  const { data: session, error: sessionError } = await supabase
    .from('mock_exam_sessions')
    .select('id, status, started_at, time_limit_seconds')
    .eq('id', sessionId)
    .eq('student_id', studentId)
    .maybeSingle()

  if (sessionError) {
    throw new Error('Unable to submit this mock exam.')
  }

  if (!session) {
    return null
  }

  if (session.status !== 'in_progress') {
    // Already finalised — return the stored totals so the caller can route to results.
    const { data: existing } = await supabase
      .from('mock_exam_sessions')
      .select('total_questions, correct_count, incorrect_count, unanswered_count, accuracy')
      .eq('id', sessionId)
      .maybeSingle()

    return {
      sessionId,
      totalQuestions: existing?.total_questions ?? 0,
      correctCount: existing?.correct_count ?? 0,
      incorrectCount: existing?.incorrect_count ?? 0,
      unansweredCount: existing?.unanswered_count ?? 0,
      accuracy: existing?.accuracy ?? 0,
    }
  }

  const { data: rows, error: rowsError } = await supabase
    .from('mock_exam_session_questions')
    .select(`
      question_id,
      selected_option_label,
      time_spent_seconds,
      question:questions(
        id,
        subject_id,
        topic_id,
        question_type_id,
        exam_type,
        difficulty,
        correct_option_label
      )
    `)
    .eq('session_id', sessionId)

  if (rowsError) {
    throw new Error('Unable to grade this mock exam.')
  }

  interface GradedRow {
    questionId: string
    selectedLabel: QuestionOptionLabel | null
    timeSpentSeconds: number | null
    subjectId: string
    topicId: string
    questionTypeId: string | null
    examType: ExamType
    difficulty: number
    correctLabel: QuestionOptionLabel
  }

  const graded: GradedRow[] = ((rows ?? []) as unknown as Array<{
    question_id: string
    selected_option_label: QuestionOptionLabel | null
    time_spent_seconds: number | null
    question: {
      id: string
      subject_id: string
      topic_id: string
      question_type_id: string | null
      exam_type: ExamType
      difficulty: number
      correct_option_label: QuestionOptionLabel
    } | null
  }>)
    .filter((row) => row.question !== null)
    .map((row) => ({
      questionId: row.question_id,
      selectedLabel: row.selected_option_label,
      timeSpentSeconds: row.time_spent_seconds,
      subjectId: row.question!.subject_id,
      topicId: row.question!.topic_id,
      questionTypeId: row.question!.question_type_id,
      examType: row.question!.exam_type,
      difficulty: row.question!.difficulty,
      correctLabel: row.question!.correct_option_label,
    }))

  let correctCount = 0
  let incorrectCount = 0
  let unansweredCount = 0

  const attemptRows: Record<string, unknown>[] = []

  for (const row of graded) {
    const isAnswered = row.selectedLabel !== null
    const isCorrect = isAnswered && row.selectedLabel === row.correctLabel

    if (!isAnswered) {
      unansweredCount += 1
    } else if (isCorrect) {
      correctCount += 1
    } else {
      incorrectCount += 1
    }

    // Only answered questions get a question_attempts row (selected_option_label is NOT NULL there).
    if (isAnswered) {
      attemptRows.push({
        session_id: null,
        student_id: studentId,
        question_id: row.questionId,
        selected_option_label: row.selectedLabel,
        correct_option_label: row.correctLabel,
        is_correct: isCorrect,
        time_taken_seconds: Math.max(0, Math.round(row.timeSpentSeconds ?? 0)),
        mode: 'mock',
        subject_id: row.subjectId,
        topic_id: row.topicId,
        question_type_id: row.questionTypeId,
        exam_type: row.examType,
        difficulty: row.difficulty,
      })
    }
  }

  if (attemptRows.length) {
    const { error: attemptError } = await supabase.from('question_attempts').insert(attemptRows)
    if (attemptError) {
      throw new Error('Unable to record your mock exam answers.')
    }
  }

  // Mistake tracking: every missed question (wrong OR unanswered) routes into Smart Revision;
  // correct answers still refresh any existing mistake record. Centralised via upsertMistakeQuestion.
  for (const row of graded) {
    const isAnswered = row.selectedLabel !== null
    const isCorrect = isAnswered && row.selectedLabel === row.correctLabel

    await upsertMistakeQuestion({
      studentId,
      questionId: row.questionId,
      subjectId: row.subjectId,
      topicId: row.topicId,
      questionTypeId: row.questionTypeId,
      examType: row.examType,
      difficulty: row.difficulty,
      answeredCorrectly: isCorrect,
    })
  }

  const totalQuestions = graded.length
  const accuracy =
    totalQuestions > 0 ? Number(((correctCount / totalQuestions) * 100).toFixed(1)) : 0

  const elapsedSeconds = Math.round((Date.now() - new Date(session.started_at).getTime()) / 1000)
  const totalTimeSeconds = Math.max(
    0,
    Math.min(elapsedSeconds, session.time_limit_seconds)
  )

  const { error: updateError } = await supabase
    .from('mock_exam_sessions')
    .update({
      status: 'submitted',
      submitted_at: new Date().toISOString(),
      total_questions: totalQuestions,
      correct_count: correctCount,
      incorrect_count: incorrectCount,
      unanswered_count: unansweredCount,
      accuracy,
      total_time_seconds: totalTimeSeconds,
    })
    .eq('id', sessionId)
    .eq('student_id', studentId)

  if (updateError) {
    throw new Error('Unable to finalise your mock exam results.')
  }

  return {
    sessionId,
    totalQuestions,
    correctCount,
    incorrectCount,
    unansweredCount,
    accuracy,
  }
}
