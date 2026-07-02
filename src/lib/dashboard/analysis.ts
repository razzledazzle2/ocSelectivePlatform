import type { AreaInsight, DashboardRecommendation, WeakStrongInsights } from '@/lib/types'

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

interface AreaAccumulator {
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

export function computeWeakStrong(attempts: AttemptForAnalysis[]): WeakStrongInsights {
  const totalAttempts = attempts.length
  const areas = new Map<string, AreaAccumulator>()

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

  const qualifying: AreaInsight[] = [...areas.values()]
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
