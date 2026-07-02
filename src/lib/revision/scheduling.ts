import type { MistakeStatus } from '@/lib/types'

const DAY_MS = 24 * 60 * 60 * 1000

export interface MistakeSchedule {
  status: MistakeStatus
  nextReviewAt: string | null
  correctStreak: number
  masteredAt: string | null
}

export function isoInDays(now: Date, days: number): string {
  return new Date(now.getTime() + days * DAY_MS).toISOString()
}

/**
 * Simple rule-based spaced repetition (Phase 3 MVP).
 *
 * Incorrect          -> needs_review, review tomorrow, streak reset
 * Correct streak 1   -> learning,   review in 3 days
 * Correct streak 2   -> improving,  review in 7 days
 * Correct streak 3+  -> mastered,   no urgent review
 */
export function scheduleAfterIncorrect(now: Date): MistakeSchedule {
  return {
    status: 'needs_review',
    nextReviewAt: isoInDays(now, 1),
    correctStreak: 0,
    masteredAt: null,
  }
}

export function scheduleAfterCorrectRetry(previousStreak: number, now: Date): MistakeSchedule {
  const correctStreak = Math.max(0, previousStreak) + 1

  if (correctStreak >= 3) {
    return { status: 'mastered', nextReviewAt: null, correctStreak, masteredAt: now.toISOString() }
  }

  if (correctStreak === 2) {
    return { status: 'improving', nextReviewAt: isoInDays(now, 7), correctStreak, masteredAt: null }
  }

  return { status: 'learning', nextReviewAt: isoInDays(now, 3), correctStreak, masteredAt: null }
}
