import { createClient } from '@/lib/supabase/server'
import { scheduleAfterCorrectRetry, scheduleAfterIncorrect } from '@/lib/revision/scheduling'
import { getQuestionOptionStats } from '@/lib/questions/option-stats'
import type {
  AttemptFeedback,
  PracticeSessionSummary,
  QuestionOptionLabel,
} from '@/lib/types'

interface CreatePracticeSessionInput {
  studentId: string
  examType: string
  subjectId: string
  topicId: string | null
  difficulty: number | null
  totalQuestions: number
}

interface SaveQuestionAttemptInput {
  sessionId: string
  studentId: string
  questionId: string
  selectedOptionLabel: QuestionOptionLabel
  timeTakenSeconds: number
}

interface UpsertMistakeQuestionInput {
  studentId: string
  questionId: string
  subjectId: string
  topicId: string
  questionTypeId: string | null
  examType: string
  difficulty: number
  answeredCorrectly: boolean
}

export async function createPracticeSession(input: CreatePracticeSessionInput): Promise<string> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('practice_sessions')
    .insert({
      student_id: input.studentId,
      mode: 'practice',
      exam_type: input.examType,
      subject_id: input.subjectId,
      topic_id: input.topicId,
      difficulty: input.difficulty,
      total_questions: input.totalQuestions,
      correct_count: 0,
      incorrect_count: 0,
      accuracy: null,
      total_time_seconds: 0,
    })
    .select('id')
    .single()

  if (error || !data) {
    throw new Error('Unable to create a practice session.')
  }

  return data.id
}

export async function upsertMistakeQuestion(input: UpsertMistakeQuestionInput): Promise<void> {
  const supabase = await createClient()
  const { data: existing, error: loadError } = await supabase
    .from('student_mistake_questions')
    .select('id, times_incorrect, times_correct_after_mistake, status, correct_streak, next_review_at')
    .eq('student_id', input.studentId)
    .eq('question_id', input.questionId)
    .maybeSingle()

  if (loadError) {
    throw new Error('Unable to update mistake tracking.')
  }

  const now = new Date()
  const timestamp = now.toISOString()

  // New mistake: only create a record when the student got it wrong.
  if (!existing && !input.answeredCorrectly) {
    const schedule = scheduleAfterIncorrect(now)
    const { error: insertError } = await supabase.from('student_mistake_questions').insert({
      student_id: input.studentId,
      question_id: input.questionId,
      subject_id: input.subjectId,
      topic_id: input.topicId,
      question_type_id: input.questionTypeId,
      exam_type: input.examType,
      difficulty: input.difficulty,
      times_incorrect: 1,
      times_correct_after_mistake: 0,
      last_incorrect_at: timestamp,
      last_attempted_at: timestamp,
      status: schedule.status,
      correct_streak: schedule.correctStreak,
      next_review_at: schedule.nextReviewAt,
    })

    if (insertError) {
      throw new Error('Unable to create the mistake tracking record.')
    }

    return
  }

  if (!existing) {
    return
  }

  // Existing record, answered incorrectly again: bump the counter and reset the schedule.
  if (!input.answeredCorrectly) {
    const schedule = scheduleAfterIncorrect(now)
    const { error: updateError } = await supabase
      .from('student_mistake_questions')
      .update({
        subject_id: input.subjectId,
        topic_id: input.topicId,
        question_type_id: input.questionTypeId,
        exam_type: input.examType,
        difficulty: input.difficulty,
        times_incorrect: existing.times_incorrect + 1,
        last_incorrect_at: timestamp,
        last_attempted_at: timestamp,
        status: schedule.status,
        correct_streak: schedule.correctStreak,
        next_review_at: schedule.nextReviewAt,
      })
      .eq('id', existing.id)

    if (updateError) {
      throw new Error('Unable to update the mistake tracking record.')
    }

    return
  }

  // Existing record answered correctly. If the review was due, this counts as a
  // completed review and advances the spaced-repetition ladder; answering early
  // (before the due date) records the win without shortcutting the intervals.
  const isDue =
    existing.status !== 'mastered' &&
    existing.next_review_at !== null &&
    new Date(existing.next_review_at).getTime() <= now.getTime()

  const correctUpdate: Record<string, unknown> = {
    last_attempted_at: timestamp,
    times_correct_after_mistake: existing.times_correct_after_mistake + 1,
  }

  if (isDue) {
    const schedule = scheduleAfterCorrectRetry(existing.correct_streak ?? 0, now)
    correctUpdate.status = schedule.status
    correctUpdate.correct_streak = schedule.correctStreak
    correctUpdate.next_review_at = schedule.nextReviewAt
    correctUpdate.mastered_at = schedule.masteredAt
    correctUpdate.last_reviewed_at = timestamp
  }

  const { error: correctUpdateError } = await supabase
    .from('student_mistake_questions')
    .update(correctUpdate)
    .eq('id', existing.id)

  if (correctUpdateError) {
    throw new Error('Unable to refresh mistake tracking after a correct answer.')
  }
}

export async function saveQuestionAttempt(input: SaveQuestionAttemptInput): Promise<AttemptFeedback> {
  const supabase = await createClient()
  const { data: question, error: questionError } = await supabase
    .from('questions')
    .select(`
      id,
      subject_id,
      topic_id,
      question_type_id,
      exam_type,
      difficulty,
      correct_option_label,
      short_explanation,
      worked_solution
    `)
    .eq('id', input.questionId)
    .eq('status', 'published')
    .maybeSingle()

  if (questionError || !question) {
    throw new Error('Unable to load the question for this attempt.')
  }

  const isCorrect = question.correct_option_label === input.selectedOptionLabel

  const { data: attempt, error: attemptError } = await supabase
    .from('question_attempts')
    .insert({
      session_id: input.sessionId,
      student_id: input.studentId,
      question_id: input.questionId,
      selected_option_label: input.selectedOptionLabel,
      correct_option_label: question.correct_option_label,
      is_correct: isCorrect,
      time_taken_seconds: input.timeTakenSeconds,
      mode: 'practice',
      subject_id: question.subject_id,
      topic_id: question.topic_id,
      question_type_id: question.question_type_id,
      exam_type: question.exam_type,
      difficulty: question.difficulty,
    })
    .select('id')
    .single()

  if (attemptError || !attempt) {
    throw new Error('Unable to save the question attempt.')
  }

  await upsertMistakeQuestion({
    studentId: input.studentId,
    questionId: input.questionId,
    subjectId: question.subject_id,
    topicId: question.topic_id,
    questionTypeId: question.question_type_id,
    examType: question.exam_type,
    difficulty: question.difficulty,
    answeredCorrectly: isCorrect,
  })

  return {
    attemptId: attempt.id,
    isCorrect,
    correctOptionLabel: question.correct_option_label,
    shortExplanation: question.short_explanation,
    workedSolution: question.worked_solution,
    optionStats: await getQuestionOptionStats(input.questionId),
  }
}

export async function updatePracticeSessionResults(
  sessionId: string,
  summary: Omit<PracticeSessionSummary, 'sessionId'>
): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('practice_sessions')
    .update({
      total_questions: summary.totalQuestions,
      correct_count: summary.correctCount,
      incorrect_count: summary.incorrectCount,
      accuracy: summary.accuracy,
      total_time_seconds: summary.totalTimeSeconds,
      completed_at: new Date().toISOString(),
    })
    .eq('id', sessionId)

  if (error) {
    throw new Error('Unable to save the practice session summary.')
  }
}
