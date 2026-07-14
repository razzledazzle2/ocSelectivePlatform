/**
 * Dashboard activity / streak / calendar tests.
 *
 * The core guarantee: feeding the pre-grouped day rows (from the
 * get_student_daily_activity Postgres function) into summariseActivityFromDays
 * yields the SAME ActivitySummary as aggregating raw attempts with
 * summariseActivity — so pushing the grouping into SQL changes nothing that a
 * student sees. Streak/calendar/week semantics are pinned separately.
 * Run: node --test --experimental-strip-types "src/lib/dashboard/*.test.ts"
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  buildActivityCalendar,
  computeCurrentStreak,
  computeLongestStreak,
  countActiveDaysThisMonth,
  countQuestionsThisWeek,
  countQuestionsThisWeekFromDays,
  summariseActivity,
  summariseActivityFromDays,
  toDateKey,
  type AttemptActivityInput,
  type DailyActivityRow,
} from './activity.ts'

const DAY_MS = 24 * 60 * 60 * 1000
// 15:00 in Sydney — far from midnight, so the Sydney calendar date always equals
// the UTC calendar date of the 04:00Z timestamp, whatever the DST offset.
const NOW = new Date('2026-03-15T04:00:00.000Z')

/** ISO timestamp for `offset` days before NOW, held at 04:00Z. */
function dayOffsetISO(offset: number): string {
  return new Date(NOW.getTime() - offset * DAY_MS).toISOString()
}

function attemptsOn(offset: number, opts: { practice?: number; revision?: number }): AttemptActivityInput[] {
  const iso = dayOffsetISO(offset)
  const rows: AttemptActivityInput[] = []
  for (let i = 0; i < (opts.practice ?? 0); i += 1) rows.push({ attemptedAt: iso, isRevision: false })
  for (let i = 0; i < (opts.revision ?? 0); i += 1) rows.push({ attemptedAt: iso, isRevision: true })
  return rows
}

/** Rebuild the compact day rows the SQL function would return, from raw attempts. */
function toDayRows(attempts: AttemptActivityInput[]): DailyActivityRow[] {
  const byDay = new Map<string, DailyActivityRow>()
  for (const a of attempts) {
    const dayKey = toDateKey(new Date(a.attemptedAt))
    const row = byDay.get(dayKey) ?? { dayKey, practice: 0, revision: 0, total: 0 }
    row.total += 1
    if (a.isRevision) row.revision += 1
    else row.practice += 1
    byDay.set(dayKey, row)
  }
  return [...byDay.values()]
}

test('empty history → empty summary', () => {
  const summary = summariseActivity([])
  assert.equal(summary.activeDays.size, 0)
  assert.equal(summary.dayActivity.size, 0)
  assert.equal(computeCurrentStreak(summary.activeDays, NOW), 0)
  assert.equal(computeLongestStreak(summary.activeDays), 0)
})

test('active-day threshold: >= 5 practice OR any revision', () => {
  // 4 practice = not active.
  assert.equal(summariseActivity(attemptsOn(0, { practice: 4 })).activeDays.size, 0)
  // 5 practice = active.
  assert.equal(summariseActivity(attemptsOn(0, { practice: 5 })).activeDays.size, 1)
  // 1 revision (with few practice) = active.
  assert.equal(summariseActivity(attemptsOn(0, { practice: 1, revision: 1 })).activeDays.size, 1)
})

test('summariseActivity == summariseActivityFromDays (SQL-grouping parity)', () => {
  const attempts = [
    ...attemptsOn(0, { practice: 6 }),
    ...attemptsOn(1, { practice: 3, revision: 1 }),
    ...attemptsOn(2, { practice: 2 }), // inactive day (2 practice, no revision)
    ...attemptsOn(40, { revision: 2 }),
  ]
  const fromAttempts = summariseActivity(attempts)
  const fromDays = summariseActivityFromDays(toDayRows(attempts))
  assert.deepEqual(fromDays.dayActivity, fromAttempts.dayActivity)
  assert.deepEqual(fromDays.activeDays, fromAttempts.activeDays)
})

test('current streak counts consecutive active days ending today', () => {
  const attempts = [
    ...attemptsOn(0, { practice: 5 }),
    ...attemptsOn(1, { practice: 5 }),
    ...attemptsOn(2, { revision: 1 }),
    // gap at offset 3
    ...attemptsOn(4, { practice: 5 }),
  ]
  assert.equal(computeCurrentStreak(summariseActivity(attempts).activeDays, NOW), 3)
})

test('current streak may end yesterday when nothing done yet today', () => {
  const attempts = [...attemptsOn(1, { practice: 5 }), ...attemptsOn(2, { practice: 5 })]
  // Nothing today (offset 0) but two active days behind it.
  assert.equal(computeCurrentStreak(summariseActivity(attempts).activeDays, NOW), 2)
})

test('a two-day gap breaks the current streak', () => {
  const attempts = [...attemptsOn(3, { practice: 5 }), ...attemptsOn(4, { practice: 5 })]
  assert.equal(computeCurrentStreak(summariseActivity(attempts).activeDays, NOW), 0)
})

test('longest streak finds the longest run anywhere in history', () => {
  const attempts = [
    ...attemptsOn(10, { practice: 5 }),
    ...attemptsOn(11, { practice: 5 }),
    ...attemptsOn(12, { practice: 5 }),
    ...attemptsOn(13, { practice: 5 }),
    // gap
    ...attemptsOn(20, { practice: 5 }),
  ]
  assert.equal(computeLongestStreak(summariseActivity(attempts).activeDays), 4)
})

test('active days this month ignores prior months', () => {
  const attempts = [
    ...attemptsOn(0, { practice: 5 }), // 2026-03-15
    ...attemptsOn(5, { practice: 5 }), // 2026-03-10
    ...attemptsOn(30, { practice: 5 }), // 2026-02-13 — different month
  ]
  assert.equal(countActiveDaysThisMonth(summariseActivity(attempts).activeDays, NOW), 2)
})

test('questions this week: per-attempt == per-day, and excludes earlier days', () => {
  // NOW is Sunday 2026-03-15; ISO week Mon 2026-03-09 .. Sun 2026-03-15.
  const attempts = [
    ...attemptsOn(0, { practice: 3, revision: 1 }), // in-week: 4
    ...attemptsOn(6, { practice: 2 }), // Mon 03-09, in-week: 2
    ...attemptsOn(7, { practice: 9 }), // Sun 03-08, previous week: excluded
  ]
  assert.equal(countQuestionsThisWeek(attempts, NOW), 6)
  assert.equal(countQuestionsThisWeekFromDays(toDayRows(attempts), NOW), 6)
})

test('calendar grid: counts every attempt per day and marks active days', () => {
  const attempts = [...attemptsOn(0, { practice: 6 }), ...attemptsOn(1, { practice: 2 })]
  const calendar = buildActivityCalendar(summariseActivity(attempts), NOW)
  assert.equal(calendar.days.length, 31) // March
  const today = calendar.days.find((d) => d.date === '2026-03-15')
  const yesterday = calendar.days.find((d) => d.date === '2026-03-14')
  assert.deepEqual({ count: today?.count, active: today?.active }, { count: 6, active: true })
  assert.deepEqual({ count: yesterday?.count, active: yesterday?.active }, { count: 2, active: false })
})

test('scale: 6000 attempts over ~400 days — day path matches raw path exactly', () => {
  const attempts: AttemptActivityInput[] = []
  for (let i = 0; i < 6000; i += 1) {
    const offset = i % 400
    attempts.push({ attemptedAt: dayOffsetISO(offset), isRevision: i % 7 === 0 })
  }
  const dayRows = toDayRows(attempts)
  const fromAttempts = summariseActivity(attempts)
  const fromDays = summariseActivityFromDays(dayRows)

  assert.deepEqual(fromDays.activeDays, fromAttempts.activeDays)
  assert.deepEqual(fromDays.dayActivity, fromAttempts.dayActivity)
  assert.equal(
    computeCurrentStreak(fromDays.activeDays, NOW),
    computeCurrentStreak(fromAttempts.activeDays, NOW)
  )
  assert.equal(computeLongestStreak(fromDays.activeDays), computeLongestStreak(fromAttempts.activeDays))
  assert.equal(
    countQuestionsThisWeekFromDays(dayRows, NOW),
    countQuestionsThisWeek(attempts, NOW)
  )
})
