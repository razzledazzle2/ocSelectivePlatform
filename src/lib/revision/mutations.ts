import { createClient } from '@/lib/supabase/server'
import { scheduleAfterCorrectRetry, scheduleAfterIncorrect } from '@/lib/revision/scheduling'
import { getQuestionOptionStats } from '@/lib/questions/option-stats'
import type { QuestionOptionLabel, RevisionRetryFeedback } from '@/lib/types'

interface RetryMistakeInput {
  studentId: string
  questionId: string
  selectedOptionLabel: QuestionOptionLabel
  timeTakenSeconds?: number
}

/**
 * Retry a tracked mistake: saves a fresh question_attempts row and advances (or resets) the
 * spaced-repetition schedule on the student_mistake_questions record.
 */
export async function retryMistake(input: RetryMistakeInput): Promise<RevisionRetryFeedback> {
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
    throw new Error('Unable to load the question for this retry.')
  }

  // Revision retries are MCQ-only; without an answer key the retry cannot be
  // graded, so fail gracefully instead of recording a bogus attempt.
  if (!question.correct_option_label) {
    throw new Error('This question is no longer available for retry.')
  }

  const isCorrect = question.correct_option_label === input.selectedOptionLabel
  const now = new Date()
  const timestamp = now.toISOString()

  const { error: attemptError } = await supabase.from('question_attempts').insert({
    session_id: null,
    student_id: input.studentId,
    question_id: input.questionId,
    selected_option_label: input.selectedOptionLabel,
    correct_option_label: question.correct_option_label,
    is_correct: isCorrect,
    time_taken_seconds: input.timeTakenSeconds ?? 0,
    mode: 'revision',
    subject_id: question.subject_id,
    topic_id: question.topic_id,
    question_type_id: question.question_type_id,
    exam_type: question.exam_type,
    difficulty: question.difficulty,
  })

  if (attemptError) {
    throw new Error('Unable to save your retry attempt.')
  }

  const { data: existing, error: loadError } = await supabase
    .from('student_mistake_questions')
    .select('id, times_incorrect, times_correct_after_mistake, correct_streak')
    .eq('student_id', input.studentId)
    .eq('question_id', input.questionId)
    .maybeSingle()

  if (loadError) {
    throw new Error('Unable to load the mistake record for this retry.')
  }

  const feedbackBase = {
    isCorrect,
    correctOptionLabel: question.correct_option_label as QuestionOptionLabel,
    shortExplanation: question.short_explanation as string | null,
    // worked_solution is nullable in v2 — fall back so feedback never breaks.
    workedSolution: (question.worked_solution ?? question.short_explanation ?? '') as string,
    optionStats: await getQuestionOptionStats(input.questionId),
  }

  // Guard: a mistake record should exist for anything on the revision page, but tolerate its absence.
  if (!existing) {
    return { ...feedbackBase, status: isCorrect ? 'learning' : 'needs_review', nextReviewAt: null }
  }

  const schedule = isCorrect
    ? scheduleAfterCorrectRetry(existing.correct_streak ?? 0, now)
    : scheduleAfterIncorrect(now)

  const update: Record<string, unknown> = {
    correct_streak: schedule.correctStreak,
    status: schedule.status,
    next_review_at: schedule.nextReviewAt,
    last_attempted_at: timestamp,
    last_reviewed_at: timestamp,
  }

  if (isCorrect) {
    update.times_correct_after_mistake = existing.times_correct_after_mistake + 1
    update.mastered_at = schedule.masteredAt
  } else {
    update.times_incorrect = existing.times_incorrect + 1
    update.last_incorrect_at = timestamp
  }

  const { error: updateError } = await supabase
    .from('student_mistake_questions')
    .update(update)
    .eq('id', existing.id)

  if (updateError) {
    throw new Error('Unable to update your revision progress.')
  }

  return { ...feedbackBase, status: schedule.status, nextReviewAt: schedule.nextReviewAt }
}

/**
 * Manually mark a tracked mistake as understood (mastered), clearing its review schedule.
 */
export async function markMistakeUnderstood(studentId: string, questionId: string): Promise<void> {
  const supabase = await createClient()
  const now = new Date().toISOString()

  const { error } = await supabase
    .from('student_mistake_questions')
    .update({
      status: 'mastered',
      mastered_at: now,
      next_review_at: null,
      last_reviewed_at: now,
    })
    .eq('student_id', studentId)
    .eq('question_id', questionId)

  if (error) {
    throw new Error('Unable to mark this question as understood.')
  }
}
