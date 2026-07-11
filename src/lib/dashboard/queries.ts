import {
  buildActivityCalendar,
  computeCurrentStreak,
  computeLongestStreak,
  countActiveDaysThisMonth,
  countQuestionsThisWeekFromDays,
  summariseActivity,
  summariseActivityFromDays,
  type ActivitySummary,
  type DailyActivityRow,
} from '@/lib/dashboard/activity'
import {
  buildRecommendations,
  computeWeakStrongFromAreas,
  formatAreaLabel,
  groupAttemptsToAreas,
  summariseRevisionDue,
  type AreaStat,
  type RevisionDueArea,
} from '@/lib/dashboard/analysis'
import { getRecentPracticeSessions } from '@/lib/practice/queries'
import { createClient } from '@/lib/supabase/server'
import type { RevisionDueSummary, StudentDashboardData, WeakStrongInsights } from '@/lib/types'

/**
 * Dashboard reads. Counting, grouping and aggregation happen in Postgres
 * (the `get_student_*` functions in migration `student_dashboard_aggregates`)
 * so a summary figure never streams a student's whole raw attempt history.
 *
 * Each aggregate prefers its Postgres function and falls back to bounded
 * app-side aggregation while that migration is still pending — mirroring
 * `getAdminQuestionStats`. The fallback fetches only the columns it needs (no
 * relation joins on the activity path) and never applies an arbitrary row cap,
 * so results stay correct, just heavier, until the functions are live.
 */

function relationName(value: { name: string }[] | { name: string } | null): string | null {
  if (Array.isArray(value)) {
    return value[0]?.name ?? null
  }
  return value?.name ?? null
}

/* -------------------------------------------------------------------------- */
/* Activity / accuracy aggregate                                               */
/* -------------------------------------------------------------------------- */

interface ActivityAggregate {
  summary: ActivitySummary
  dayTotals: DailyActivityRow[]
  totalAttempts: number
  correctAttempts: number
}

interface DailyActivityRpcRow {
  activity_day: string
  practice_count: number | string
  revision_count: number | string
  total_count: number | string
  correct_count: number | string
}

/** Per-day activity + lifetime totals, grouped in Postgres. */
async function getActivityAggregate(studentId: string): Promise<ActivityAggregate> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('get_student_daily_activity', {
    p_student_id: studentId,
  })

  if (error) {
    return getActivityAggregateFallback(studentId)
  }

  const rows = (data ?? []) as DailyActivityRpcRow[]
  const dayTotals: DailyActivityRow[] = rows.map((row) => ({
    dayKey: row.activity_day,
    practice: Number(row.practice_count),
    revision: Number(row.revision_count),
    total: Number(row.total_count),
  }))

  return {
    summary: summariseActivityFromDays(dayTotals),
    dayTotals,
    totalAttempts: dayTotals.reduce((sum, row) => sum + row.total, 0),
    correctAttempts: rows.reduce((sum, row) => sum + Number(row.correct_count), 0),
  }
}

/** App-side fallback: newest-first is irrelevant here, so fetch unordered, no joins. */
async function getActivityAggregateFallback(studentId: string): Promise<ActivityAggregate> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('question_attempts')
    .select('attempted_at, session_id, is_correct')
    .eq('student_id', studentId)

  if (error) {
    throw new Error('Unable to load dashboard data.')
  }

  const rows = (data ?? []) as Array<{
    attempted_at: string
    session_id: string | null
    is_correct: boolean
  }>
  const summary = summariseActivity(
    rows.map((row) => ({ attemptedAt: row.attempted_at, isRevision: row.session_id === null }))
  )
  const dayTotals: DailyActivityRow[] = [...summary.dayActivity.entries()].map(([dayKey, day]) => ({
    dayKey,
    practice: day.practice,
    revision: day.revision,
    total: day.total,
  }))

  return {
    summary,
    dayTotals,
    totalAttempts: rows.length,
    correctAttempts: rows.filter((row) => row.is_correct).length,
  }
}

/* -------------------------------------------------------------------------- */
/* Weak / strong area stats                                                    */
/* -------------------------------------------------------------------------- */

interface AreaStatRpcRow {
  subject_name: string
  topic_name: string | null
  question_type_name: string | null
  attempts: number | string
  correct: number | string
}

/** Per subject/topic/type attempt counts, grouped in Postgres. */
async function getAreaStats(studentId: string): Promise<AreaStat[]> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('get_student_area_stats', {
    p_student_id: studentId,
  })

  if (error) {
    return getAreaStatsFallback(studentId)
  }

  return ((data ?? []) as AreaStatRpcRow[]).map((row) => ({
    subjectName: row.subject_name,
    topicName: row.topic_name,
    questionTypeName: row.question_type_name,
    attempts: Number(row.attempts),
    correct: Number(row.correct),
  }))
}

async function getAreaStatsFallback(studentId: string): Promise<AreaStat[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('question_attempts')
    .select(`
      is_correct,
      subject:subjects(name),
      topic:topics(name),
      question_type:question_types(name)
    `)
    .eq('student_id', studentId)

  if (error) {
    throw new Error('Unable to load dashboard data.')
  }

  const rows = (data ?? []) as unknown as Array<{
    is_correct: boolean
    subject: { name: string }[] | { name: string } | null
    topic: { name: string }[] | { name: string } | null
    question_type: { name: string }[] | { name: string } | null
  }>

  return groupAttemptsToAreas(
    rows.map((row) => ({
      subjectName: relationName(row.subject),
      topicName: relationName(row.topic),
      questionTypeName: relationName(row.question_type),
      isCorrect: row.is_correct,
    }))
  )
}

/* -------------------------------------------------------------------------- */
/* Revision due summary (lightweight — no question text/options)               */
/* -------------------------------------------------------------------------- */

interface RevisionDueRpcRow {
  subject_name: string | null
  topic_name: string | null
  due_count: number | string
}

/**
 * Builds the dashboard revision-due summary from due counts grouped by area.
 * Replaces the old use of the rich `getStudentMistakeQuestions` (which joined
 * question text/type and capped at 200 rows — silently undercounting the due
 * total for heavy users).
 */
async function getRevisionDueSummary(studentId: string): Promise<RevisionDueSummary> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('get_student_revision_due_areas', {
    p_student_id: studentId,
  })

  const areas: RevisionDueArea[] = error
    ? await getRevisionDueAreasFallback(studentId)
    : ((data ?? []) as RevisionDueRpcRow[]).map((row) => ({
        subjectName: row.subject_name,
        topicName: row.topic_name,
        count: Number(row.due_count),
      }))

  return summariseRevisionDue(areas)
}

async function getRevisionDueAreasFallback(studentId: string): Promise<RevisionDueArea[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('student_mistake_questions')
    .select(`
      status,
      next_review_at,
      subject:subjects(name),
      topic:topics(name)
    `)
    .eq('student_id', studentId)
    .neq('status', 'mastered')
    .not('next_review_at', 'is', null)
    .lte('next_review_at', new Date().toISOString())

  if (error) {
    throw new Error('Unable to load dashboard data.')
  }

  const rows = (data ?? []) as unknown as Array<{
    subject: { name: string }[] | { name: string } | null
    topic: { name: string }[] | { name: string } | null
  }>

  // Group by (subject, topic) so the fallback returns the same shape as the RPC.
  const byArea = new Map<string, RevisionDueArea>()
  for (const row of rows) {
    const subjectName = relationName(row.subject)
    const topicName = relationName(row.topic)
    const key = `${subjectName ?? ''}|${topicName ?? ''}`
    const existing = byArea.get(key) ?? { subjectName, topicName, count: 0 }
    existing.count += 1
    byArea.set(key, existing)
  }
  return [...byArea.values()]
}

/* -------------------------------------------------------------------------- */
/* Composed reads                                                              */
/* -------------------------------------------------------------------------- */

export async function getStudentDashboardData(studentId: string): Promise<StudentDashboardData> {
  const now = new Date()

  const [activity, areaStats, revisionDue, recentSessions] = await Promise.all([
    getActivityAggregate(studentId),
    getAreaStats(studentId),
    getRevisionDueSummary(studentId),
    getRecentPracticeSessions(studentId),
  ])

  // -- Activity, streaks, calendar ----------------------------------------
  const currentStreak = computeCurrentStreak(activity.summary.activeDays, now)
  const longestStreak = computeLongestStreak(activity.summary.activeDays)
  const activeDaysThisMonth = countActiveDaysThisMonth(activity.summary.activeDays, now)
  const questionsThisWeek = countQuestionsThisWeekFromDays(activity.dayTotals, now)
  const calendar = buildActivityCalendar(activity.summary, now)

  // -- Accuracy -----------------------------------------------------------
  const totalAttempts = activity.totalAttempts
  const overallAccuracy =
    totalAttempts > 0 ? Number(((activity.correctAttempts / totalAttempts) * 100).toFixed(1)) : null

  // -- Weak / strong areas ------------------------------------------------
  const insights = computeWeakStrongFromAreas(areaStats, totalAttempts)

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

export interface PracticeHubStats {
  hasActivity: boolean
  revisionDue: RevisionDueSummary
  insights: WeakStrongInsights
}

/**
 * The strict subset of dashboard data the Practice Hub needs. Avoids computing
 * the calendar, streaks and recent-session list the practice page never renders.
 */
export async function getPracticeHubData(studentId: string): Promise<PracticeHubStats> {
  const [totalAttempts, areaStats, revisionDue] = await Promise.all([
    countStudentAttempts(studentId),
    getAreaStats(studentId),
    getRevisionDueSummary(studentId),
  ])

  return {
    hasActivity: totalAttempts > 0,
    revisionDue,
    insights: computeWeakStrongFromAreas(areaStats, totalAttempts),
  }
}

/** Lifetime attempt count via a head-only COUNT (no rows returned). */
async function countStudentAttempts(studentId: string): Promise<number> {
  const supabase = await createClient()
  const { count, error } = await supabase
    .from('question_attempts')
    .select('id', { count: 'exact', head: true })
    .eq('student_id', studentId)

  if (error) {
    throw new Error('Unable to load practice data.')
  }

  return count ?? 0
}

// Re-exported for any callers that want the raw label formatting.
export { formatAreaLabel }
