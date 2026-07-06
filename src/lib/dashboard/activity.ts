import type { ActivityCalendar, ActivityCalendarDay } from '@/lib/types'

/**
 * Pure, testable activity/streak helpers for the student dashboard.
 * All calendar dates are normalised to a single timezone so day boundaries are consistent.
 */

export const ACTIVITY_TIMEZONE = 'Australia/Sydney'
const DAY_MS = 24 * 60 * 60 * 1000

// A day counts as active if the student completed >= 5 practice questions OR any revision retry.
const ACTIVE_PRACTICE_THRESHOLD = 5

const keyFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: ACTIVITY_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

const monthLabelFormatter = new Intl.DateTimeFormat('en-AU', {
  timeZone: ACTIVITY_TIMEZONE,
  month: 'long',
  year: 'numeric',
})

export interface AttemptActivityInput {
  attemptedAt: string
  /** Revision retries are saved with a null session id; practice attempts carry a session id. */
  isRevision: boolean
}

export interface DayActivity {
  total: number
  practice: number
  revision: number
}

export interface ActivitySummary {
  dayActivity: Map<string, DayActivity>
  activeDays: Set<string>
}

/** YYYY-MM-DD key for a date in the activity timezone. */
export function toDateKey(date: Date): string {
  return keyFormatter.format(date)
}

function dayNumberFromKey(key: string): number {
  const [year, month, day] = key.split('-').map(Number)
  return Math.round(Date.UTC(year, month - 1, day) / DAY_MS)
}

function keyFromDayNumber(dayNumber: number): string {
  return new Date(dayNumber * DAY_MS).toISOString().slice(0, 10)
}

function isDayActive(activity: DayActivity): boolean {
  return activity.practice >= ACTIVE_PRACTICE_THRESHOLD || activity.revision >= 1
}

export function summariseActivity(attempts: AttemptActivityInput[]): ActivitySummary {
  const dayActivity = new Map<string, DayActivity>()

  for (const attempt of attempts) {
    const key = toDateKey(new Date(attempt.attemptedAt))
    const existing = dayActivity.get(key) ?? { total: 0, practice: 0, revision: 0 }
    existing.total += 1
    if (attempt.isRevision) {
      existing.revision += 1
    } else {
      existing.practice += 1
    }
    dayActivity.set(key, existing)
  }

  const activeDays = new Set<string>()
  for (const [key, activity] of dayActivity.entries()) {
    if (isDayActive(activity)) {
      activeDays.add(key)
    }
  }

  return { dayActivity, activeDays }
}

/**
 * Current streak = consecutive active days ending today, or ending yesterday if the student
 * has not been active yet today.
 */
export function computeCurrentStreak(activeDays: Set<string>, now: Date): number {
  const todayKey = toDateKey(now)
  let cursor = dayNumberFromKey(todayKey)

  if (!activeDays.has(keyFromDayNumber(cursor))) {
    cursor -= 1 // allow the streak to end yesterday if nothing done yet today
  }

  let streak = 0
  while (activeDays.has(keyFromDayNumber(cursor))) {
    streak += 1
    cursor -= 1
  }

  return streak
}

export function computeLongestStreak(activeDays: Set<string>): number {
  if (activeDays.size === 0) {
    return 0
  }

  const dayNumbers = [...activeDays].map(dayNumberFromKey).sort((a, b) => a - b)
  let longest = 1
  let run = 1

  for (let index = 1; index < dayNumbers.length; index += 1) {
    if (dayNumbers[index] === dayNumbers[index - 1] + 1) {
      run += 1
    } else if (dayNumbers[index] !== dayNumbers[index - 1]) {
      run = 1
    }
    longest = Math.max(longest, run)
  }

  return longest
}

export function countActiveDaysThisMonth(activeDays: Set<string>, now: Date): number {
  const prefix = toDateKey(now).slice(0, 7) // YYYY-MM
  let count = 0
  for (const key of activeDays) {
    if (key.startsWith(prefix)) {
      count += 1
    }
  }
  return count
}

/** Number of attempts in the current ISO week (Monday–Sunday) in the activity timezone. */
export function countQuestionsThisWeek(attempts: AttemptActivityInput[], now: Date): number {
  const todayNumber = dayNumberFromKey(toDateKey(now))
  // Monday = 0 offset. Date.UTC weekday: Sunday=0..Saturday=6.
  const weekday = new Date(todayNumber * DAY_MS).getUTCDay()
  const mondayOffset = (weekday + 6) % 7
  const weekStartNumber = todayNumber - mondayOffset

  return attempts.filter((attempt) => dayNumberFromKey(toDateKey(new Date(attempt.attemptedAt))) >= weekStartNumber)
    .length
}

/** Builds a calendar grid for the current month with per-day activity counts. */
export function buildActivityCalendar(summary: ActivitySummary, now: Date): ActivityCalendar {
  const todayKey = toDateKey(now)
  const [year, month] = todayKey.split('-').map(Number)
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const firstWeekday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay()

  const days: ActivityCalendarDay[] = []
  for (let day = 1; day <= daysInMonth; day += 1) {
    const key = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    const activity = summary.dayActivity.get(key)
    days.push({
      date: key,
      count: activity?.total ?? 0,
      active: summary.activeDays.has(key),
    })
  }

  return {
    monthLabel: monthLabelFormatter.format(now),
    firstWeekday,
    days,
  }
}
