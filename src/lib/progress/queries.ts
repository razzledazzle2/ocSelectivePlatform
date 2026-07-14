import { rankAreaInsights, computeWeakStrongFromAreas } from '@/lib/dashboard/analysis'
import { buildActivityCalendar, toDateKey, type DailyActivityRow } from '@/lib/dashboard/activity'
import { getActivityAggregate, getAreaStats } from '@/lib/dashboard/queries'
import { getStudentMasteryOverview } from '@/lib/mastery/queries'
import { getRecentPracticeSessionsPage } from '@/lib/practice/queries'
import type { ProgressRange, StudentProgressData } from '@/lib/types'

const DAY_MS = 24 * 60 * 60 * 1000

// "Term" has no explicit start/end date in the schema yet, so it is approximated
// as a trailing 90-day window (roughly one school term) until a real term
// calendar exists.
const RANGE_WINDOW_DAYS: Record<Exclude<ProgressRange, 'all'>, number> = {
  '7d': 7,
  '30d': 30,
  term: 90,
}

function windowDays(range: ProgressRange): number | null {
  return range === 'all' ? null : RANGE_WINDOW_DAYS[range]
}

/** Rows whose dayKey falls within the trailing `days` days ending today (inclusive). Null days = all-time. */
function sliceCurrentWindow(rows: DailyActivityRow[], now: Date, days: number | null): DailyActivityRow[] {
  if (days === null) return rows
  const cutoffKey = toDateKey(new Date(now.getTime() - (days - 1) * DAY_MS))
  return rows.filter((row) => row.dayKey >= cutoffKey)
}

/** The `days`-long window immediately preceding the current window, for period comparison. */
function slicePreviousWindow(rows: DailyActivityRow[], now: Date, days: number): DailyActivityRow[] {
  const currentStartKey = toDateKey(new Date(now.getTime() - (days - 1) * DAY_MS))
  const previousStartKey = toDateKey(new Date(now.getTime() - (2 * days - 1) * DAY_MS))
  return rows.filter((row) => row.dayKey >= previousStartKey && row.dayKey < currentStartKey)
}

function summariseWindow(rows: DailyActivityRow[]): { questions: number; accuracy: number | null } {
  const questions = rows.reduce((sum, row) => sum + row.total, 0)
  const correct = rows.reduce((sum, row) => sum + row.correct, 0)
  return { questions, accuracy: questions > 0 ? Number(((correct / questions) * 100).toFixed(1)) : null }
}

/**
 * The Progress page's date-ranged analytics. Reuses the same Postgres-grouped
 * day rows and area stats as the dashboard (`getActivityAggregate`/
 * `getAreaStats`, already bounded to ~365 rows/year and to distinct areas, not
 * raw attempts) and slices them by range in JS — no new RPC needed for this
 * part. Subject/domain mastery is lifetime-scoped by nature (mastery is a
 * skill state, not a per-period figure), reusing `getStudentMasteryOverview`.
 */
export async function getStudentProgressData(
  studentId: string,
  range: ProgressRange,
  historyPage = 0
): Promise<StudentProgressData> {
  const now = new Date()
  const days = windowDays(range)

  const [activity, areaStats, masteryOverview, recentSessions] = await Promise.all([
    getActivityAggregate(studentId),
    getAreaStats(studentId),
    getStudentMasteryOverview(studentId),
    getRecentPracticeSessionsPage(studentId, { page: historyPage, limit: 15 }),
  ])

  const currentRows = sliceCurrentWindow(activity.dayTotals, now, days)
  const current = summariseWindow(currentRows)

  const comparison =
    days === null
      ? { questionsDelta: null, accuracyDelta: null }
      : (() => {
          const previousRows = slicePreviousWindow(activity.dayTotals, now, days)
          const previous = summariseWindow(previousRows)
          return {
            questionsDelta: current.questions - previous.questions,
            accuracyDelta:
              current.accuracy !== null && previous.accuracy !== null
                ? Number((current.accuracy - previous.accuracy).toFixed(1))
                : null,
          }
        })()

  const activeDays = currentRows.filter((row) => row.total > 0).length
  const skillsMastered = masteryOverview.subjects.reduce((sum, subject) => sum + subject.masteredCount, 0)

  const trend = [...currentRows]
    .sort((a, b) => a.dayKey.localeCompare(b.dayKey))
    .map((row) => ({
      dayKey: row.dayKey,
      questions: row.total,
      accuracy: row.total > 0 ? Number(((row.correct / row.total) * 100).toFixed(1)) : null,
    }))

  const { strongest, needsAttention } = rankAreaInsights(areaStats, activity.totalAttempts)
  const hasEnoughAreaData = computeWeakStrongFromAreas(areaStats, activity.totalAttempts).hasEnoughData

  const areaPerformance = areaStats
    .map((area) => ({
      subjectName: area.subjectName,
      topicName: area.topicName,
      attempts: area.attempts,
      correct: area.correct,
      accuracy: area.attempts > 0 ? Math.round((area.correct / area.attempts) * 100) : 0,
    }))
    .sort((a, b) => b.attempts - a.attempts)

  return {
    range,
    hasActivity: activity.totalAttempts > 0,
    metrics: {
      questionsCompleted: current.questions,
      overallAccuracy: current.accuracy,
      activeDays,
      skillsMastered,
    },
    comparison,
    trend,
    areaPerformance,
    hasEnoughAreaData,
    strongestAreas: strongest,
    needsAttentionAreas: needsAttention,
    calendar: buildActivityCalendar(activity.summary, now),
    recentSessions,
  }
}
