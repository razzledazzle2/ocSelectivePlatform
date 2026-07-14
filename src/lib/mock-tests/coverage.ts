import { ANSWER_FORMAT_LABELS } from '@/lib/types'
import type {
  CoverageBucket,
  CoverageWarning,
  MockCoverage,
  MockTestDetail,
  MockTestQuestionItem,
} from '@/lib/mock-tests/types'

function bucketsFrom(counts: Map<string, number>): CoverageBucket[] {
  return [...counts.entries()]
    .map(([key, count]) => ({ key, label: key, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
}

function increment(map: Map<string, number>, key: string): void {
  map.set(key, (map.get(key) ?? 0) + 1)
}

/**
 * Coverage report for a curated mock, computed purely from the questions already
 * loaded into the detail (no extra DB calls). Warnings flag composition problems
 * a tutor should notice — imbalance, difficulty skew, and repeated "families"
 * (questions that share a variant or stimulus) — but never block on their own.
 */
export function computeMockCoverage(detail: MockTestDetail): MockCoverage {
  const questions: MockTestQuestionItem[] = detail.sections.flatMap((section) => section.questions)
  const totalQuestions = questions.length

  const bySubject = new Map<string, number>()
  const byTopic = new Map<string, number>()
  const byQuestionType = new Map<string, number>()
  const byDifficulty = new Map<string, number>()
  const byAnswerFormat = new Map<string, number>()
  const bySkillTag = new Map<string, number>()

  const variantCounts = new Map<string, number>()
  const stimulusCounts = new Map<string, number>()
  const stimulusIds = new Set<string>()

  let totalMarks = 0
  let assetCount = 0
  let writingCount = 0

  for (const question of questions) {
    totalMarks += question.marks
    increment(bySubject, question.subjectName)
    increment(byTopic, question.topicName)
    increment(byQuestionType, question.questionTypeName ?? 'Unclassified')
    increment(byDifficulty, `D${question.difficulty}`)
    increment(byAnswerFormat, ANSWER_FORMAT_LABELS[question.answerFormat] ?? question.answerFormat)

    for (const tag of question.skillTags) {
      increment(bySkillTag, tag)
    }
    if (question.hasAssets) {
      assetCount += 1
    }
    if (question.answerFormat === 'extended_response') {
      writingCount += 1
    }
    if (question.variantId) {
      increment(variantCounts, question.variantId)
    }
    if (question.stimulusId) {
      increment(stimulusCounts, question.stimulusId)
      stimulusIds.add(question.stimulusId)
    }
  }

  const difficultyOrder = ['D1', 'D2', 'D3', 'D4', 'D5']
  const byDifficultyBuckets = difficultyOrder
    .filter((key) => byDifficulty.has(key))
    .map((key) => ({ key, label: key, count: byDifficulty.get(key) ?? 0 }))

  return {
    totalQuestions,
    totalMarks,
    bySubject: bucketsFrom(bySubject),
    byTopic: bucketsFrom(byTopic),
    byQuestionType: bucketsFrom(byQuestionType),
    byDifficulty: byDifficultyBuckets,
    byAnswerFormat: bucketsFrom(byAnswerFormat),
    bySkillTag: bucketsFrom(bySkillTag),
    assetCount,
    stimulusCount: stimulusIds.size,
    writingCount,
    warnings: buildWarnings(detail, questions, {
      bySubject,
      byDifficulty,
      byQuestionType,
      variantCounts,
      stimulusCounts,
    }),
  }
}

function buildWarnings(
  detail: MockTestDetail,
  questions: MockTestQuestionItem[],
  maps: {
    bySubject: Map<string, number>
    byDifficulty: Map<string, number>
    byQuestionType: Map<string, number>
    variantCounts: Map<string, number>
    stimulusCounts: Map<string, number>
  }
): CoverageWarning[] {
  const warnings: CoverageWarning[] = []
  const total = questions.length

  if (total === 0) {
    warnings.push({ tone: 'critical', message: 'This mock has no questions yet.' })
    return warnings
  }

  // Questions that would block or weaken a publish.
  const deleted = questions.filter((question) => question.deletedAt !== null).length
  if (deleted > 0) {
    warnings.push({
      tone: 'critical',
      message: `${deleted} question${deleted === 1 ? '' : 's'} in this mock ${deleted === 1 ? 'has' : 'have'} been deleted from the bank — remove ${deleted === 1 ? 'it' : 'them'} before publishing.`,
    })
  }

  const archived = questions.filter((question) => question.questionStatus === 'archived').length
  if (archived > 0) {
    warnings.push({
      tone: 'critical',
      message: `${archived} archived question${archived === 1 ? '' : 's'} included — students never see archived questions.`,
    })
  }

  const unpublished = questions.filter(
    (question) => question.questionStatus !== 'published' && question.questionStatus !== 'archived'
  ).length
  if (unpublished > 0) {
    warnings.push({
      tone: 'warning',
      message: `${unpublished} question${unpublished === 1 ? ' is' : 's are'} not published yet — publish ${unpublished === 1 ? 'it' : 'them'} in the Question Bank first.`,
    })
  }

  // Subject imbalance (only meaningful with more than one subject present).
  if (maps.bySubject.size > 1) {
    const [topSubject, topCount] = [...maps.bySubject.entries()].sort((a, b) => b[1] - a[1])[0]
    if (topCount / total >= 0.7) {
      warnings.push({
        tone: 'warning',
        message: `${Math.round((topCount / total) * 100)}% of questions are ${topSubject} — the paper is heavily weighted to one subject.`,
      })
    }
  }

  // Difficulty skew.
  const [topDifficulty, topDifficultyCount] = [...maps.byDifficulty.entries()].sort((a, b) => b[1] - a[1])[0] ?? [null, 0]
  if (topDifficulty && topDifficultyCount / total >= 0.8) {
    warnings.push({
      tone: 'info',
      message: `Most questions are difficulty ${topDifficulty.replace('D', '')} — consider spreading the difficulty range.`,
    })
  }

  // Question-type concentration.
  if (maps.byQuestionType.size > 1) {
    const [topType, topTypeCount] = [...maps.byQuestionType.entries()].sort((a, b) => b[1] - a[1])[0]
    if (topType !== 'Unclassified' && topTypeCount / total >= 0.6) {
      warnings.push({
        tone: 'info',
        message: `${topTypeCount} of ${total} questions are "${topType}" — the question-type mix is narrow.`,
      })
    }
  }

  // Duplicate "family": several questions sharing a variant or a stimulus.
  const variantRepeat = [...maps.variantCounts.values()].filter((count) => count >= 3).length
  if (variantRepeat > 0) {
    const worst = Math.max(...maps.variantCounts.values())
    warnings.push({
      tone: 'warning',
      message: `${worst} questions come from the same question family (shared variant) — students may see near-duplicates.`,
    })
  }
  const stimulusRepeat = [...maps.stimulusCounts.values()].filter((count) => count >= 4).length
  if (stimulusRepeat > 0) {
    const worst = Math.max(...maps.stimulusCounts.values())
    warnings.push({
      tone: 'info',
      message: `${worst} questions share the same stimulus/passage.`,
    })
  }

  // Subjects with a linked section but no questions.
  for (const section of detail.sections) {
    if (section.sectionKey !== 'writing' && section.questions.length === 0) {
      warnings.push({
        tone: 'info',
        message: `The ${section.name} section has no questions.`,
      })
    }
  }

  return warnings
}
