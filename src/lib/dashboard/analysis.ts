import type {
  AreaInsight,
  DashboardRecommendation,
  RevisionDueSummary,
  WeakStrongInsights,
} from '@/lib/types'

/**
 * Minimum data required before we surface weak/strong insights, so early users are not shown
 * noisy conclusions from a handful of attempts.
 */
const MIN_TOTAL_ATTEMPTS = 8
const MIN_ATTEMPTS_PER_AREA = 4

export interface AttemptForAnalysis {
  subjectName: string | null
  topicName: string | null
  questionTypeName: string | null
  isCorrect: boolean
}

/**
 * A per-area accumulator, as returned pre-grouped by the `get_student_area_stats`
 * Postgres function. `attempts`/`correct` are counts; `subjectName` is always set
 * (areas with no subject are dropped upstream, matching the app rule).
 */
export interface AreaStat {
  subjectName: string
  topicName: string | null
  questionTypeName: string | null
  attempts: number
  correct: number
}

function areaKey(attempt: AttemptForAnalysis): string | null {
  if (!attempt.subjectName) {
    return null
  }
  return [attempt.subjectName, attempt.topicName ?? '', attempt.questionTypeName ?? ''].join('|')
}

/**
 * The shared weak/strong ranking. `totalAttempts` is the LIFETIME attempt total
 * (including attempts with no subject, which never form an area) and gates
 * whether we have enough data at all. Areas below MIN_ATTEMPTS_PER_AREA are
 * ignored so a single lucky/unlucky area cannot dominate.
 */
export function computeWeakStrongFromAreas(
  areas: AreaStat[],
  totalAttempts: number
): WeakStrongInsights {
  const qualifying: AreaInsight[] = areas
    .filter((area) => area.attempts >= MIN_ATTEMPTS_PER_AREA)
    .map((area) => ({
      subjectName: area.subjectName,
      topicName: area.topicName,
      questionTypeName: area.questionTypeName,
      attempts: area.attempts,
      correct: area.correct,
      accuracy: Math.round((area.correct / area.attempts) * 100),
    }))

  if (totalAttempts < MIN_TOTAL_ATTEMPTS || qualifying.length === 0) {
    return { hasEnoughData: false, strongest: null, weakest: null }
  }

  const sorted = [...qualifying].sort((a, b) => a.accuracy - b.accuracy)
  const weakest = sorted[0]
  const strongest = sorted[sorted.length - 1]

  return {
    hasEnoughData: true,
    weakest,
    // Only surface a distinct "strongest" when it differs from the weakest area.
    strongest: strongest === weakest ? null : strongest,
  }
}

/**
 * Groups raw attempts into per-area accumulators, keyed by subject/topic/type
 * name. Attempts with no subject are dropped (they can never form an area). This
 * is the app-side equivalent of the `get_student_area_stats` Postgres grouping.
 */
export function groupAttemptsToAreas(attempts: AttemptForAnalysis[]): AreaStat[] {
  const areas = new Map<string, AreaStat>()

  for (const attempt of attempts) {
    const key = areaKey(attempt)
    if (!key || !attempt.subjectName) {
      continue
    }
    const existing =
      areas.get(key) ??
      {
        subjectName: attempt.subjectName,
        topicName: attempt.topicName,
        questionTypeName: attempt.questionTypeName,
        attempts: 0,
        correct: 0,
      }
    existing.attempts += 1
    if (attempt.isCorrect) {
      existing.correct += 1
    }
    areas.set(key, existing)
  }

  return [...areas.values()]
}

/** Groups raw attempts into areas then ranks them (app-side fallback path). */
export function computeWeakStrong(attempts: AttemptForAnalysis[]): WeakStrongInsights {
  return computeWeakStrongFromAreas(groupAttemptsToAreas(attempts), attempts.length)
}

/** One subject/topic bucket of due revision items, as grouped by area upstream. */
export interface RevisionDueArea {
  subjectName: string | null
  topicName: string | null
  count: number
}

/**
 * Rolls per-area due counts into the dashboard summary: the total due count and
 * the three busiest labelled areas. Mirrors the previous in-query roll-up, but
 * ties are broken alphabetically so the ordering is deterministic.
 */
export function summariseRevisionDue(areas: RevisionDueArea[]): RevisionDueSummary {
  const labelCounts = new Map<string, number>()
  let dueCount = 0
  for (const area of areas) {
    dueCount += area.count
    const label =
      [area.subjectName, area.topicName].filter(Boolean).join(' — ') || 'General revision'
    labelCounts.set(label, (labelCounts.get(label) ?? 0) + area.count)
  }

  return {
    dueCount,
    topAreas: [...labelCounts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 3)
      .map(([name, count]) => ({ name, count })),
  }
}

export function formatAreaLabel(area: AreaInsight): string {
  const parts = [area.subjectName]
  if (area.topicName) {
    parts.push(area.topicName)
  }
  return parts.join(' — ')
}

interface RecommendationInput {
  hasActivity: boolean
  revisionDueCount: number
  currentStreak: number
  weakest: AreaInsight | null
}

/** Simple, rule-based recommendations (no AI). Returns up to three, most useful first. */
export function buildRecommendations(input: RecommendationInput): DashboardRecommendation[] {
  const recommendations: DashboardRecommendation[] = []

  if (!input.hasActivity) {
    return [
      {
        id: 'first-practice',
        title: 'Start your first practice set',
        description: 'Answer a few questions to begin building your progress and revision queue.',
        href: '/student/practice',
        ctaLabel: 'Start practice',
      },
    ]
  }

  if (input.revisionDueCount > 0) {
    recommendations.push({
      id: 'revise-due',
      title: 'Revise questions due today',
      description: `You have ${input.revisionDueCount} question${
        input.revisionDueCount === 1 ? '' : 's'
      } ready for review. A short revision set keeps them fresh.`,
      href: '/student/revision',
      ctaLabel: 'Open revision',
    })
  }

  if (input.weakest) {
    const label = formatAreaLabel(input.weakest)
    const lowAccuracy = input.weakest.accuracy < 60
    recommendations.push({
      id: 'practise-weak',
      title: lowAccuracy ? `Review worked solutions for ${label}` : `Practise ${label}`,
      description: lowAccuracy
        ? `Your accuracy here is ${input.weakest.accuracy}%. Re-reading the worked solutions will help before you try more.`
        : `This is your lowest-accuracy area at ${input.weakest.accuracy}%. A focused set of 10 questions will help.`,
      href: lowAccuracy ? '/student/revision' : '/student/practice',
      ctaLabel: lowAccuracy ? 'Review solutions' : 'Practise now',
    })
  }

  if (input.currentStreak > 0 && recommendations.length < 3) {
    recommendations.push({
      id: 'keep-streak',
      title: `Keep your ${input.currentStreak}-day streak`,
      description: 'A short practice session today keeps your streak alive.',
      href: '/student/practice',
      ctaLabel: 'Quick practice',
    })
  }

  if (recommendations.length === 0) {
    recommendations.push({
      id: 'keep-practising',
      title: 'Keep practising',
      description: 'Work through a new set to strengthen your accuracy across topics.',
      href: '/student/practice',
      ctaLabel: 'Start practice',
    })
  }

  return recommendations.slice(0, 3)
}
