import { getRecentPracticeSessions, getStudentMistakeQuestions } from '@/lib/practice/queries'
import { createClient } from '@/lib/supabase/server'
import type { StudentDashboardStats } from '@/lib/types'

export async function getStudentDashboardStats(studentId: string): Promise<StudentDashboardStats> {
  const supabase = await createClient()
  const [{ data: attempts, error: attemptsError }, recentSessions, recentMistakes] = await Promise.all([
    supabase
      .from('question_attempts')
      .select(`
        is_correct,
        subject:subjects(name),
        topic:topics(name)
      `)
      .eq('student_id', studentId),
    getRecentPracticeSessions(studentId),
    getStudentMistakeQuestions(studentId),
  ])

  if (attemptsError) {
    throw new Error('Unable to load dashboard statistics.')
  }

  const completedQuestions = attempts?.length ?? 0
  const correctAnswers = (attempts ?? []).filter((attempt) => attempt.is_correct).length
  const incorrectAnswers = completedQuestions - correctAnswers
  const overallAccuracy = completedQuestions > 0 ? Number(((correctAnswers / completedQuestions) * 100).toFixed(1)) : null

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

    const subjectName = Array.isArray(attempt.subject)
      ? attempt.subject[0]?.name
      : attempt.subject?.name
    const topicName = Array.isArray(attempt.topic) ? attempt.topic[0]?.name : attempt.topic?.name

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

  return {
    questionsCompleted: completedQuestions,
    correctAnswers,
    incorrectAnswers,
    overallAccuracy,
    recentSessions,
    recentMistakes: recentMistakes.slice(0, 6),
    weakestSubject,
    weakestTopic,
  }
}
