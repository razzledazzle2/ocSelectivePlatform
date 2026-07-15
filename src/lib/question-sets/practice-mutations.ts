import { gradeReadingSet, selectCompleteSets, type GradeInput } from '@/lib/question-sets/core'
import { getReadingSetOutlines } from '@/lib/question-sets/queries'
import { upsertMistakeQuestion } from '@/lib/practice/mutations'
import { createClient } from '@/lib/supabase/server'
import type { ExamType, QuestionOptionLabel, ReadingSetSubmitResult } from '@/lib/types'

/**
 * Starts a reading practice session covering one or more COMPLETE reading sets.
 * A practice_sessions row anchors the attempt; one practice_set_answers row per
 * child question records membership + order and enables autosave/resume. The
 * selection always takes whole sets — it never splits one.
 */
export async function startReadingPracticeSession(input: {
  studentId: string
  examType: ExamType
  subjectId: string
  /** How many complete sets to include, or 'all'. */
  setCount: number | 'all'
}): Promise<{ sessionId: string; setCount: number; questionCount: number } | null> {
  const outlines = await getReadingSetOutlines(input.examType, input.subjectId)
  if (outlines.length === 0) {
    return null
  }

  const chosen = selectCompleteSets(outlines, input.setCount)

  const questionCount = chosen.reduce((total, set) => total + set.questionIds.length, 0)
  if (questionCount === 0) {
    return null
  }

  const supabase = await createClient()
  const { data: session, error: sessionError } = await supabase
    .from('practice_sessions')
    .insert({
      student_id: input.studentId,
      mode: 'practice',
      exam_type: input.examType,
      subject_id: input.subjectId,
      topic_id: null,
      difficulty: null,
      total_questions: questionCount,
      correct_count: 0,
      incorrect_count: 0,
      accuracy: null,
      total_time_seconds: 0,
    })
    .select('id')
    .single()

  if (sessionError || !session) {
    throw new Error('Unable to start the reading practice session.')
  }

  const answerRows = chosen.flatMap((set) =>
    set.questionIds.map((questionId, index) => ({
      session_id: session.id,
      set_id: set.setId,
      question_id: questionId,
      position: index + 1,
      selected_option_label: null,
      time_spent_seconds: 0,
      is_submitted: false,
      is_correct: null,
    }))
  )

  const { error: answersError } = await supabase.from('practice_set_answers').insert(answerRows)
  if (answersError) {
    throw new Error('Unable to prepare the reading practice questions.')
  }

  return { sessionId: session.id, setCount: chosen.length, questionCount }
}

/**
 * Autosaves a single answer while the student works through a set. This ONLY
 * records the selection — it never grades, never touches mistakes, and never
 * reveals correctness. Ignored once the question's set is submitted.
 */
export async function autosaveReadingAnswer(input: {
  sessionId: string
  studentId: string
  questionId: string
  selectedOptionLabel: QuestionOptionLabel | null
  timeSpentSeconds: number
}): Promise<void> {
  const supabase = await createClient()

  // Confirm the session belongs to the student (RLS also enforces this).
  const { data: session, error: sessionError } = await supabase
    .from('practice_sessions')
    .select('id')
    .eq('id', input.sessionId)
    .eq('student_id', input.studentId)
    .maybeSingle()

  if (sessionError || !session) {
    throw new Error('Unable to save your answer.')
  }

  const { error } = await supabase
    .from('practice_set_answers')
    .update({
      selected_option_label: input.selectedOptionLabel,
      time_spent_seconds: Math.max(0, Math.round(input.timeSpentSeconds)),
    })
    .eq('session_id', input.sessionId)
    .eq('question_id', input.questionId)
    // Frozen once submitted — a submitted set cannot be re-answered.
    .eq('is_submitted', false)

  if (error) {
    throw new Error('Unable to save your answer.')
  }
}

/**
 * Submits and grades ONE reading set. Idempotent: a set whose answers are
 * already submitted returns its stored result and awards nothing twice. Grading
 * happens here and only here — each child question is graded individually, a
 * normal question_attempts row is written for analytics, and Smart Revision is
 * updated. The session summary is refreshed after each set submission.
 */
export async function submitReadingSet(input: {
  sessionId: string
  studentId: string
  setId: string
}): Promise<ReadingSetSubmitResult | null> {
  const supabase = await createClient()

  const { data: session, error: sessionError } = await supabase
    .from('practice_sessions')
    .select('id, exam_type')
    .eq('id', input.sessionId)
    .eq('student_id', input.studentId)
    .maybeSingle()

  if (sessionError || !session) {
    return null
  }

  const { data: answerRows, error: answersError } = await supabase
    .from('practice_set_answers')
    .select('question_id, selected_option_label, is_submitted, time_spent_seconds')
    .eq('session_id', input.sessionId)
    .eq('set_id', input.setId)
    .order('position', { ascending: true })

  if (answersError) {
    throw new Error('Unable to load this set for grading.')
  }

  const answers = (answerRows ?? []) as Array<{
    question_id: string
    selected_option_label: QuestionOptionLabel | null
    is_submitted: boolean
    time_spent_seconds: number
  }>

  if (answers.length === 0) {
    return { setId: input.setId, correctCount: 0, totalQuestions: 0, results: [] }
  }

  // Idempotency: if this set was already submitted, re-grade for the return
  // value from stored data but DO NOT write attempts/mistakes again.
  const alreadySubmitted = answers.every((answer) => answer.is_submitted)

  const questionIds = answers.map((answer) => answer.question_id)
  const { data: questionRows, error: questionsError } = await supabase
    .from('questions')
    .select(
      'id, subject_id, topic_id, question_type_id, exam_type, difficulty, correct_option_label, worked_solution, short_explanation'
    )
    .in('id', questionIds)
    .eq('status', 'published')

  if (questionsError) {
    throw new Error('Unable to grade this set.')
  }

  const questionById = new Map(
    ((questionRows ?? []) as Array<{
      id: string
      subject_id: string
      topic_id: string
      question_type_id: string | null
      exam_type: ExamType
      difficulty: number
      correct_option_label: QuestionOptionLabel | null
      worked_solution: string | null
      short_explanation: string | null
    }>).map((question) => [question.id, question])
  )

  // Grade with the pure core so the logic is unit-tested and deterministic.
  const gradeInputs: GradeInput[] = answers
    .map((answer) => {
      const question = questionById.get(answer.question_id)
      if (!question || !question.correct_option_label) return null
      return {
        questionId: answer.question_id,
        selectedLabel: answer.selected_option_label,
        correctLabel: question.correct_option_label,
        workedSolution: question.worked_solution ?? question.short_explanation ?? '',
      } satisfies GradeInput
    })
    .filter((input): input is GradeInput => input !== null)

  const graded = gradeReadingSet(gradeInputs)
  const results = graded.results
  const correctCount = graded.correctCount

  const answerByQuestion = new Map(answers.map((answer) => [answer.question_id, answer]))
  const attemptRows: Record<string, unknown>[] = []
  const mistakeUpdates: Array<{
    questionId: string
    subjectId: string
    topicId: string
    questionTypeId: string | null
    examType: ExamType
    difficulty: number
    isCorrect: boolean
  }> = []

  if (!alreadySubmitted) {
    for (const result of results) {
      const question = questionById.get(result.questionId)
      const answer = answerByQuestion.get(result.questionId)
      if (!question) continue

      if (result.selectedOptionLabel) {
        attemptRows.push({
          session_id: input.sessionId,
          student_id: input.studentId,
          question_id: result.questionId,
          selected_option_label: result.selectedOptionLabel,
          correct_option_label: result.correctOptionLabel,
          is_correct: result.isCorrect,
          time_taken_seconds: Math.max(0, Math.round(answer?.time_spent_seconds ?? 0)),
          mode: 'practice',
          subject_id: question.subject_id,
          topic_id: question.topic_id,
          question_type_id: question.question_type_id,
          exam_type: question.exam_type,
          difficulty: question.difficulty,
        })
      }

      mistakeUpdates.push({
        questionId: result.questionId,
        subjectId: question.subject_id,
        topicId: question.topic_id,
        questionTypeId: question.question_type_id,
        examType: question.exam_type,
        difficulty: question.difficulty,
        isCorrect: result.isCorrect,
      })
    }
  }

  if (!alreadySubmitted) {
    if (attemptRows.length > 0) {
      const { error: attemptError } = await supabase.from('question_attempts').insert(attemptRows)
      if (attemptError) {
        throw new Error('Unable to record your answers.')
      }
    }

    // Freeze this set's answers with their per-question correctness.
    for (const result of results) {
      const { error: updateError } = await supabase
        .from('practice_set_answers')
        .update({ is_submitted: true, is_correct: result.isCorrect })
        .eq('session_id', input.sessionId)
        .eq('question_id', result.questionId)
        .eq('is_submitted', false)
      if (updateError) {
        throw new Error('Unable to finalise this set.')
      }
    }

    // Mistake tracking mirrors ordinary practice (wrong → Smart Revision).
    for (const update of mistakeUpdates) {
      await upsertMistakeQuestion({
        studentId: input.studentId,
        questionId: update.questionId,
        subjectId: update.subjectId,
        topicId: update.topicId,
        questionTypeId: update.questionTypeId,
        examType: update.examType,
        difficulty: update.difficulty,
        answeredCorrectly: update.isCorrect,
      })
    }

    await refreshReadingSessionSummary(input.sessionId, input.studentId)
  }

  return {
    setId: input.setId,
    correctCount,
    totalQuestions: results.length,
    results,
  }
}

/**
 * Recomputes the session totals from every submitted answer and marks the
 * session complete once all sets are submitted. Safe to call repeatedly.
 */
export async function refreshReadingSessionSummary(sessionId: string, studentId: string): Promise<void> {
  const supabase = await createClient()

  const { data: rows, error } = await supabase
    .from('practice_set_answers')
    .select('is_submitted, is_correct, time_spent_seconds')
    .eq('session_id', sessionId)

  if (error) {
    throw new Error('Unable to update the session summary.')
  }

  const answers = (rows ?? []) as Array<{
    is_submitted: boolean
    is_correct: boolean | null
    time_spent_seconds: number
  }>

  const submitted = answers.filter((answer) => answer.is_submitted)
  const correctCount = submitted.filter((answer) => answer.is_correct === true).length
  const incorrectCount = submitted.length - correctCount
  const totalTimeSeconds = answers.reduce((total, answer) => total + Math.max(0, answer.time_spent_seconds), 0)
  const accuracy = submitted.length > 0 ? Number(((correctCount / submitted.length) * 100).toFixed(1)) : null
  const allSubmitted = answers.length > 0 && answers.every((answer) => answer.is_submitted)

  const { error: updateError } = await supabase
    .from('practice_sessions')
    .update({
      total_questions: answers.length,
      correct_count: correctCount,
      incorrect_count: incorrectCount,
      accuracy,
      total_time_seconds: totalTimeSeconds,
      completed_at: allSubmitted ? new Date().toISOString() : null,
    })
    .eq('id', sessionId)
    .eq('student_id', studentId)

  if (updateError) {
    throw new Error('Unable to update the session summary.')
  }
}
