import type { MistakeStatus } from '@/lib/types'

export type DueTone = 'overdue' | 'due' | 'upcoming' | 'mastered' | 'none'

export interface DueStatus {
  label: string
  tone: DueTone
}

const dateFormatter = new Intl.DateTimeFormat('en-AU', { day: 'numeric', month: 'short' })

/** Shared due-status label/tone for revision queue rows and the featured card. */
export function formatDueStatus(status: MistakeStatus, nextReviewAt: string | null, now: number): DueStatus {
  if (status === 'mastered') {
    return { label: 'Mastered', tone: 'mastered' }
  }
  if (!nextReviewAt) {
    return { label: 'No review scheduled', tone: 'none' }
  }

  const dueMs = new Date(nextReviewAt).getTime()
  if (dueMs <= now) {
    return { label: 'Due now', tone: 'due' }
  }
  return { label: `Due ${dateFormatter.format(new Date(nextReviewAt))}`, tone: 'upcoming' }
}

/** Why a question keeps coming back for review, in plain language. */
export function explainReviewReason(timesIncorrect: number, correctStreak: number): string {
  if (correctStreak > 0) {
    return `Answered correctly ${correctStreak} time${correctStreak === 1 ? '' : 's'} in a row since the last mistake — one more and it moves up a stage.`
  }
  return `Missed ${timesIncorrect} time${timesIncorrect === 1 ? '' : 's'} — spaced review keeps it fresh until it sticks.`
}
