import {
  buildActivityCalendar,
  computeCurrentStreak,
  computeLongestStreak,
  countActiveDaysThisMonth,
  countQuestionsThisWeek,
  summariseActivity,
  type AttemptActivityInput,
} from '@/lib/dashboard/activity'
import { buildRecommendations, computeWeakStrong, formatAreaLabel } from '@/lib/dashboard/analysis'
import { getRecentPracticeSessions, getStudentMistakeQuestions } from '@/lib/practice/queries'
import { createClient } from '@/lib/supabase/server'
import type { RevisionDueSummary, StudentDashboardData } from '@/lib/types'

function relationName(value: { name: string }[] | { name: string } | null): string | null {
  if (Array.isArray(value)) {
    return value[0]?.name ?? null
  }
  return value?.name ?? null
}

interface AttemptRow {
  is_correct: boolean
  attempted_at: string
  session_id: string | null
  subject: { name: string }[] | { name: string } | null
  topic: { name: string }[] | { name: string } | null
  question_type: { name: string }[] | { name: string } | null
}

export async function getStudentDashboardData(studentId: string): Promise<StudentDashboardData> {
  const supabase = await createClient()

  const [{ data: attemptsData, error: attemptsError }, recentSessions, mistakes] = await Promise.all([
    supabase
      .from('question_attempts')
      .select(`
        is_correct,
        attempted_at,
        session_id,
        subject:subjects(name),
        topic:topics(name),
        question_type:question_types(name)
      `)
      .eq('student_id', studentId)
      .order('attempted_at', { ascending: false }),
    getRecentPracticeSessions(studentId),
    getStudentMistakeQuestions(studentId),
  ])

  if (attemptsError) {
    throw new Error('Unable to load dashboard data.')
  }

  const attempts = (attemptsData ?? []) as unknown as AttemptRow[]
  const now = new Date()

  // -- Activity, streaks, calendar ----------------------------------------
  const activityInput: AttemptActivityInput[] = attempts.map((attempt) => ({
    attemptedAt: attempt.attempted_at,
    isRevision: attempt.session_id === null,
  }))
  const summary = summariseActivity(activityInput)
  const currentStreak = computeCurrentStreak(summary.activeDays, now)
  const longestStreak = computeLongestStreak(summary.activeDays)
  const activeDaysThisMonth = countActiveDaysThisMonth(summary.activeDays, now)
  const questionsThisWeek = countQuestionsThisWeek(activityInput, now)
  const calendar = buildActivityCalendar(summary, now)

  // -- Accuracy -----------------------------------------------------------
  const totalAttempts = attempts.length
  const correctAttempts = attempts.filter((attempt) => attempt.is_correct).length
  const overallAccuracy =
    totalAttempts > 0 ? Number(((correctAttempts / totalAttempts) * 100).toFixed(1)) : null

  // -- Weak / strong areas ------------------------------------------------
  const insights = computeWeakStrong(
    attempts.map((attempt) => ({
      subjectName: relationName(attempt.subject),
      topicName: relationName(attempt.topic),
      questionTypeName: relationName(attempt.question_type),
      isCorrect: attempt.is_correct,
    }))
  )

  // -- Revision due today -------------------------------------------------
  const nowMs = now.getTime()
  const dueMistakes = mistakes.filter(
    (mistake) =>
      mistake.status !== 'mastered' &&
      mistake.nextReviewAt !== null &&
      new Date(mistake.nextReviewAt).getTime() <= nowMs
  )
  const dueAreaCounts = new Map<string, number>()
  for (const mistake of dueMistakes) {
    const label = [mistake.subjectName, mistake.topicName].filter(Boolean).join(' — ') || 'General revision'
    dueAreaCounts.set(label, (dueAreaCounts.get(label) ?? 0) + 1)
  }
  const revisionDue: RevisionDueSummary = {
    dueCount: dueMistakes.length,
    topAreas: [...dueAreaCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([name, count]) => ({ name, count })),
  }

  // -- Recommendations ----------------------------------------------------
  const hasActivity = totalAttempts > 0
  const recommendations = buildRecommendations({
    hasActivity,
    revisionDueCount: revisionDue.dueCount,
    currentStreak,
    weakest: insights.weakest,
  })

  return {
    hasActivity,
    metrics: {
      questionsThisWeek,
      overallAccuracy,
      currentStreak,
      revisionDueToday: revisionDue.dueCount,
    },
    streak: {
      currentStreak,
      longestStreak,
      activeDaysThisMonth,
      questionsThisWeek,
    },
    calendar,
    insights,
    revisionDue,
    recentSessions,
    recommendations,
  }
}

// Re-exported for any callers that want the raw label formatting.
export { formatAreaLabel }
