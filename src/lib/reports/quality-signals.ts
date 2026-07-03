import type {
  QualitySignal,
  QuestionAttemptStats,
  QuestionOptionLabel,
} from '@/lib/types'

/**
 * Quality-signal thresholds. All signals are derived from REAL data only
 * (question_attempts rows and open report counts). Accuracy/time signals are
 * suppressed unless there is enough attempt data to be meaningful.
 */
export const QUALITY_THRESHOLDS = {
  /** A question is flagged if it has this many open reports. */
  multipleReportsMinOpen: 2,
  /** Minimum attempts before the low-accuracy signal is trustworthy. */
  lowAccuracyMinAttempts: 5,
  /** Accuracy (0-1) below which a question is flagged. */
  lowAccuracyThreshold: 0.4,
  /** Minimum incorrect attempts before the "common wrong answer" signal shows. */
  commonWrongMinIncorrect: 3,
  /** Share (0-1) of incorrect attempts landing on one wrong option to flag it. */
  commonWrongShare: 0.6,
  /** Minimum attempts before the high-average-time signal is trustworthy. */
  highTimeMinAttempts: 5,
  /** Average seconds-per-attempt above which a question is flagged. */
  highTimeThresholdSeconds: 120,
} as const

export function emptyAttemptStats(): QuestionAttemptStats {
  return {
    totalAttempts: 0,
    correctAttempts: 0,
    incorrectAttempts: 0,
    totalTimeSeconds: 0,
    wrongAnswerCounts: {},
  }
}

interface QuestionAttemptRow {
  is_correct: boolean
  selected_option_label: QuestionOptionLabel
  time_taken_seconds: number | null
}

/** Folds raw practice-attempt rows for a single question into aggregate stats. */
export function buildAttemptStats(rows: QuestionAttemptRow[]): QuestionAttemptStats {
  const stats = emptyAttemptStats()

  for (const row of rows) {
    stats.totalAttempts += 1
    stats.totalTimeSeconds += row.time_taken_seconds ?? 0

    if (row.is_correct) {
      stats.correctAttempts += 1
    } else {
      stats.incorrectAttempts += 1
      const label = row.selected_option_label
      stats.wrongAnswerCounts[label] = (stats.wrongAnswerCounts[label] ?? 0) + 1
    }
  }

  return stats
}

export function getAccuracy(stats: QuestionAttemptStats): number | null {
  if (stats.totalAttempts === 0) {
    return null
  }
  return stats.correctAttempts / stats.totalAttempts
}

export function getAverageTimeSeconds(stats: QuestionAttemptStats): number | null {
  if (stats.totalAttempts === 0) {
    return null
  }
  return stats.totalTimeSeconds / stats.totalAttempts
}

/** Returns the single most-picked wrong option and its share of incorrect attempts. */
function getTopWrongAnswer(
  stats: QuestionAttemptStats
): { label: QuestionOptionLabel; count: number; share: number } | null {
  if (stats.incorrectAttempts === 0) {
    return null
  }

  let topLabel: QuestionOptionLabel | null = null
  let topCount = 0

  for (const [label, count] of Object.entries(stats.wrongAnswerCounts)) {
    if ((count ?? 0) > topCount) {
      topCount = count ?? 0
      topLabel = label as QuestionOptionLabel
    }
  }

  if (!topLabel) {
    return null
  }

  return { label: topLabel, count: topCount, share: topCount / stats.incorrectAttempts }
}

interface QualitySignalInput {
  stats: QuestionAttemptStats
  openReportCount: number
}

/**
 * Computes the quality signals for a single question. Each signal is only
 * emitted when its real-data conditions are met — no placeholder/fake signals.
 */
export function computeQualitySignals({ stats, openReportCount }: QualitySignalInput): QualitySignal[] {
  const signals: QualitySignal[] = []

  if (openReportCount >= QUALITY_THRESHOLDS.multipleReportsMinOpen) {
    signals.push({
      type: 'multiple_reports',
      label: `${openReportCount} open reports`,
      detail: `${openReportCount} unresolved reports point at this question.`,
      tone: 'critical',
    })
  }

  const accuracy = getAccuracy(stats)
  if (
    accuracy !== null &&
    stats.totalAttempts >= QUALITY_THRESHOLDS.lowAccuracyMinAttempts &&
    accuracy < QUALITY_THRESHOLDS.lowAccuracyThreshold
  ) {
    signals.push({
      type: 'low_accuracy',
      label: `${Math.round(accuracy * 100)}% correct`,
      detail: `Only ${Math.round(accuracy * 100)}% of ${stats.totalAttempts} attempts are correct.`,
      tone: 'warning',
    })
  }

  const topWrong = getTopWrongAnswer(stats)
  if (
    topWrong &&
    stats.incorrectAttempts >= QUALITY_THRESHOLDS.commonWrongMinIncorrect &&
    topWrong.share >= QUALITY_THRESHOLDS.commonWrongShare
  ) {
    signals.push({
      type: 'common_wrong_answer',
      label: `Most pick ${topWrong.label}`,
      detail: `${Math.round(topWrong.share * 100)}% of wrong answers chose option ${topWrong.label} — a possible mis-keyed answer.`,
      tone: 'warning',
    })
  }

  const averageTime = getAverageTimeSeconds(stats)
  if (
    averageTime !== null &&
    stats.totalAttempts >= QUALITY_THRESHOLDS.highTimeMinAttempts &&
    averageTime > QUALITY_THRESHOLDS.highTimeThresholdSeconds
  ) {
    signals.push({
      type: 'high_avg_time',
      label: `${Math.round(averageTime)}s average`,
      detail: `Students spend ${Math.round(averageTime)}s on average across ${stats.totalAttempts} attempts.`,
      tone: 'neutral',
    })
  }

  return signals
}
