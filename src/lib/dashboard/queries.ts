import { getRecentPracticeSessions, getStudentMistakeQuestions } from '@/lib/practice/queries'
import { createClient } from '@/lib/supabase/server'
import type { RecentAttempt, StudentDashboardStats } from '@/lib/types'

function getRelationName(value: { name: string }[] | { name: string } | null): string | null {
  if (Array.isArray(value)) {
    return value[0]?.name ?? null
  }
  return value?.name ?? null
}

async function getRecentAttempts(studentId: string): Promise<RecentAttempt[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('question_attempts')
    .select(`
      id,
      is_correct,
      attempted_at,
      question:questions(question_text),
      subject:subjects(name),
      topic:topics(name)
    `)
    .eq('student_id', studentId)
    .order('attempted_at', { ascending: false })
    .limit(6)

  if (error) {
    throw new Error('Unable to load recent attempts.')
  }

  return ((data ?? []) as unknown as Array<{
    id: string
    is_correct: boolean
    attempted_at: string
    question: { question_text: string }[] | { question_text: string } | null
    subject: { name: string }[] | { name: string } | null
    topic: { name: string }[] | { name: string } | null
  }>).map((attempt) => {
    const question = Array.isArray(attempt.question) ? attempt.question[0] : attempt.question
    return {
      id: attempt.id,
      questionText: question?.question_text ?? 'Question unavailable',
      subjectName: getRelationName(attempt.subject),
      topicName: getRelationName(attempt.topic),
      isCorrect: attempt.is_correct,
      attemptedAt: attempt.attempted_at,
    }
  })
}

export async function getStudentDashboardStats(studentId: string): Promise<StudentDashboardStats> {
  const supabase = await createClient()
  const [{ data: attempts, error: attemptsError }, recentSessions, recentAttempts, allMistakes] =
    await Promise.all([
      supabase
        .from('question_attempts')
        .select(`
          is_correct,
          subject:subjects(name),
          topic:topics(name)
        `)
        .eq('student_id', studentId),
      getRecentPracticeSessions(studentId),
      getRecentAttempts(studentId),
      getStudentMistakeQuestions(studentId),
    ])

  if (attemptsError) {
    throw new Error('Unable to load dashboard statistics.')
  }

  const completedQuestions = attempts?.length ?? 0
  const correctAnswers = (attempts ?? []).filter((attempt) => attempt.is_correct).length
  const incorrectAnswers = completedQuestions - correctAnswers
  const overallAccuracy =
    completedQuestions > 0 ? Number(((correctAnswers / completedQuestions) * 100).toFixed(1)) : null

  const subjectCounts = new Map<string, number>()
  const topicCounts = new Map<string, number>()

  for (const attempt of (attempts ?? []) as Array<{
    is_correct: boolean
    subject: { name: string }[] | { name: string } | null
    topic: { name: string }[] | { name: string } | null
  }>) {
    if (attempt.is_correct) {
      continue
    }

    const subjectName = getRelationName(attempt.subject)
    const topicName = getRelationName(attempt.topic)

    if (subjectName) {
      subjectCounts.set(subjectName, (subjectCounts.get(subjectName) ?? 0) + 1)
    }
    if (topicName) {
      topicCounts.set(topicName, (topicCounts.get(topicName) ?? 0) + 1)
    }
  }

  const weakestSubject =
    incorrectAnswers >= 3
      ? [...subjectCounts.entries()].sort((left, right) => right[1] - left[1])[0]?.[0] ?? null
      : null
  const weakestTopic =
    incorrectAnswers >= 3
      ? [...topicCounts.entries()].sort((left, right) => right[1] - left[1])[0]?.[0] ?? null
      : null

  const now = Date.now()
  const revisionDueToday = allMistakes.filter(
    (mistake) =>
      mistake.status !== 'mastered' &&
      mistake.nextReviewAt !== null &&
      new Date(mistake.nextReviewAt).getTime() <= now
  ).length

  return {
    questionsCompleted: completedQuestions,
    correctAnswers,
    incorrectAnswers,
    overallAccuracy,
    revisionDueToday,
    recentSessions,
    recentAttempts,
    recentMistakes: allMistakes.slice(0, 6),
    weakestSubject,
    weakestTopic,
  }
}
