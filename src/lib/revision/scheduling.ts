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
 * Rule-based spaced repetition ladder.
 *
 * Incorrect          -> needs_review,    review in 1 day, streak reset
 * Correct streak 1   -> learning,        review in 7 days
 * Correct streak 2   -> improving,       review in 30 days
 * Correct streak 3   -> almost_mastered, review in 180 days
 * Correct streak 4+  -> mastered,        no further reviews
 */
export const REVIEW_INTERVAL_DAYS: Record<number, number> = {
  0: 1,
  1: 7,
  2: 30,
  3: 180,
}

export const MASTERY_STREAK = 4

export function scheduleAfterIncorrect(now: Date): MistakeSchedule {
  return {
    status: 'needs_review',
    nextReviewAt: isoInDays(now, REVIEW_INTERVAL_DAYS[0]),
    correctStreak: 0,
    masteredAt: null,
  }
}

export function scheduleAfterCorrectRetry(previousStreak: number, now: Date): MistakeSchedule {
  const correctStreak = Math.max(0, previousStreak) + 1

  if (correctStreak >= MASTERY_STREAK) {
    return { status: 'mastered', nextReviewAt: null, correctStreak, masteredAt: now.toISOString() }
  }

  if (correctStreak === 3) {
    return {
      status: 'almost_mastered',
      nextReviewAt: isoInDays(now, REVIEW_INTERVAL_DAYS[3]),
      correctStreak,
      masteredAt: null,
    }
  }

  if (correctStreak === 2) {
    return {
      status: 'improving',
      nextReviewAt: isoInDays(now, REVIEW_INTERVAL_DAYS[2]),
      correctStreak,
      masteredAt: null,
    }
  }

  return {
    status: 'learning',
    nextReviewAt: isoInDays(now, REVIEW_INTERVAL_DAYS[1]),
    correctStreak,
    masteredAt: null,
  }
}
