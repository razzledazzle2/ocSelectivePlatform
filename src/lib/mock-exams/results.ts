import { createClient } from '@/lib/supabase/server'
import { getMockExamSummary } from '@/lib/mock-exams/queries'
import {
  MOCK_COMPARISON_MIN_PARTICIPANTS,
  type MockExamBreakdownRow,
  type MockExamComparison,
  type MockExamRecommendation,
  type MockExamResults,
  type MockExamReviewQuestion,
} from '@/lib/mock-exams/types'
import type {
  QuestionOptionLabel,
  QuestionOptionRecord,
  QuestionRecord,
} from '@/lib/types'

function getRelationValue<T>(value: T | T[] | null): T | null {
  if (Array.isArray(value)) {
    return value[0] ?? null
  }
  return value ?? null
}

interface BreakdownAccumulator {
  label: string
  total: number
  correct: number
  incorrect: number
  unanswered: number
}

function buildBreakdown(
  questions: MockExamReviewQuestion[],
  keyOf: (question: MockExamReviewQuestion) => string | null
): MockExamBreakdownRow[] {
  const groups = new Map<string, BreakdownAccumulator>()

  for (const question of questions) {
    const label = keyOf(question)
    if (!label) {
      continue
    }

    const group = groups.get(label) ?? { label, total: 0, correct: 0, incorrect: 0, unanswered: 0 }
    group.total += 1
    if (!question.isAnswered) {
      group.unanswered += 1
    } else if (question.isCorrect) {
      group.correct += 1
    } else {
      group.incorrect += 1
    }
    groups.set(label, group)
  }

  return [...groups.values()]
    .map((group) => ({
      ...group,
      accuracy: group.total > 0 ? Math.round((group.correct / group.total) * 100) : 0,
    }))
    .sort((a, b) => a.accuracy - b.accuracy || b.total - a.total)
}

/**
 * Simple rule-based revision recommendations (no AI): surface the weakest topic and question
 * type, plus links back into the core learning loop (revise mistakes, practise weak areas).
 */
function buildRecommendations(
  topicBreakdown: MockExamBreakdownRow[],
  questionTypeBreakdown: MockExamBreakdownRow[],
  hasMistakes: boolean
): MockExamRecommendation[] {
  const recommendations: MockExamRecommendation[] = []

  const weakestTopic = topicBreakdown.find((row) => row.total > 0 && row.accuracy < 100)
  if (weakestTopic && (weakestTopic.incorrect + weakestTopic.unanswered) >= 2) {
    recommendations.push({
      id: 'weak-topic',
      title: `Revisit ${weakestTopic.label}`,
      description: `You scored ${weakestTopic.accuracy}% on ${weakestTopic.label}. Targeted practice here will lift your next mock score.`,
      href: '/student/practice',
      ctaLabel: 'Practise this topic',
    })
  }

  const weakestType = questionTypeBreakdown.find((row) => row.total > 0 && row.accuracy < 60)
  if (weakestType) {
    recommendations.push({
      id: 'weak-type',
      title: `Work on ${weakestType.label} questions`,
      description: `${weakestType.label} accuracy was ${weakestType.accuracy}%. Practising this question type will help most.`,
      href: '/student/practice',
      ctaLabel: 'Practise question type',
    })
  }

  if (hasMistakes) {
    recommendations.push({
      id: 'revise-mistakes',
      title: 'Revise your mock mistakes',
      description: 'Every question you missed was added to Smart Revision. Retry them to move them towards mastered.',
      href: '/student/revision',
      ctaLabel: 'Go to revision',
    })
  }

  if (!recommendations.length) {
    recommendations.push({
      id: 'keep-going',
      title: 'Strong performance',
      description: 'Great work. Try a different mock type or a harder set to keep building exam stamina.',
      href: '/student/mock-exams',
      ctaLabel: 'Try another mock',
    })
  }

  return recommendations
}

/**
 * Builds the full results view for a submitted mock exam. Reveals correct answers and worked
 * solutions, so it is scoped to the owning student and returns null for anything else.
 */
export async function getMockExamResults(
  sessionId: string,
  studentId: string
): Promise<MockExamResults | null> {
  const summary = await getMockExamSummary(sessionId, studentId)

  if (!summary) {
    return null
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('mock_exam_session_questions')
    .select(`
      question_order,
      selected_option_label,
      is_flagged,
      time_spent_seconds,
      question:questions(
        id,
        difficulty,
        question_text,
        passage_text,
        correct_option_label,
        short_explanation,
        worked_solution,
        subject:subjects(name),
        topic:topics(name),
        question_type:question_types(name)
      )
    `)
    .eq('session_id', sessionId)
    .order('question_order', { ascending: true })

  if (error) {
    throw new Error('Unable to load your mock exam results.')
  }

  const rows = (data ?? []) as unknown as Array<{
    question_order: number
    selected_option_label: QuestionOptionLabel | null
    is_flagged: boolean
    time_spent_seconds: number | null
    question: (Pick<
      QuestionRecord,
      'id' | 'difficulty' | 'question_text' | 'passage_text' | 'correct_option_label' | 'short_explanation' | 'worked_solution'
    > & {
      subject: { name: string }[] | { name: string } | null
      topic: { name: string }[] | { name: string } | null
      question_type: { name: string }[] | { name: string } | null
    })
      | null
  }>

  const validRows = rows.filter((row) => row.question !== null)

  const supabaseOptions = await supabase
    .from('question_options')
    .select('id, question_id, label, option_text, sort_order, created_at')
    .in('question_id', validRows.map((row) => row.question!.id))
    .order('sort_order', { ascending: true })

  const optionsMap = new Map<string, QuestionOptionRecord[]>()
  for (const option of (supabaseOptions.data ?? []) as Array<
    QuestionOptionRecord & { question_id: string }
  >) {
    const existing = optionsMap.get(option.question_id) ?? []
    existing.push(option)
    optionsMap.set(option.question_id, existing)
  }

  const reviewQuestions: MockExamReviewQuestion[] = validRows.map((row) => {
    const question = row.question!
    const selected = row.selected_option_label
    const isAnswered = selected !== null
    const correctLabel = question.correct_option_label
    return {
      questionId: question.id,
      questionOrder: row.question_order,
      timeSpentSeconds: row.time_spent_seconds,
      subjectName: getRelationValue(question.subject)?.name ?? 'Subject',
      topicName: getRelationValue(question.topic)?.name ?? 'Topic',
      questionTypeName: getRelationValue(question.question_type)?.name ?? null,
      difficulty: question.difficulty,
      questionText: question.question_text,
      passageText: question.passage_text,
      options: optionsMap.get(question.id) ?? [],
      selectedOptionLabel: selected,
      correctOptionLabel: correctLabel,
      isCorrect: isAnswered && selected === correctLabel,
      isAnswered,
      isFlagged: row.is_flagged,
      shortExplanation: question.short_explanation,
      workedSolution: question.worked_solution,
    }
  })

  const answeredCount = reviewQuestions.filter((question) => question.isAnswered).length
  const totalTime = summary.totalTimeSeconds
  const averageTimeSeconds = answeredCount > 0 ? Math.round(totalTime / answeredCount) : 0
  const flaggedCount = reviewQuestions.filter((question) => question.isFlagged).length

  const subjectBreakdown = buildBreakdown(reviewQuestions, (question) => question.subjectName)
  const topicBreakdown = buildBreakdown(reviewQuestions, (question) => question.topicName)
  const questionTypeBreakdown = buildBreakdown(
    reviewQuestions,
    (question) => question.questionTypeName
  )

  const missedQuestions = reviewQuestions.filter((question) => !question.isCorrect)
  const recommendations = buildRecommendations(
    topicBreakdown,
    questionTypeBreakdown,
    missedQuestions.length > 0
  )

  const [comparison, writingSection] = await Promise.all([
    getMockExamComparison(sessionId),
    getWritingSection(sessionId),
  ])

  return {
    session: summary,
    averageTimeSeconds,
    flaggedCount,
    subjectBreakdown,
    topicBreakdown,
    questionTypeBreakdown,
    reviewQuestions,
    recommendations,
    comparison,
    writingSection,
  }
}

/**
 * Average accuracy + rank across students who submitted the same kind of mock,
 * via the get_mock_exam_comparison security-definer function. Returns null (no
 * comparison shown) below the participant threshold or on any failure — the UI
 * then shows a clean "not enough data" message instead of misleading numbers.
 */
async function getMockExamComparison(sessionId: string): Promise<MockExamComparison | null> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('get_mock_exam_comparison', {
    p_session_id: sessionId,
  })

  if (error || !data) {
    return null
  }

  const row = (Array.isArray(data) ? data[0] : data) as
    | {
        participant_count: number | string | null
        average_accuracy: number | string | null
        student_rank: number | string | null
      }
    | undefined

  if (!row) {
    return null
  }

  const participantCount = Number(row.participant_count ?? 0)
  const averageAccuracy = Number(row.average_accuracy ?? Number.NaN)
  const rank = Number(row.student_rank ?? Number.NaN)

  if (
    !Number.isFinite(participantCount) ||
    !Number.isFinite(averageAccuracy) ||
    !Number.isFinite(rank) ||
    participantCount < MOCK_COMPARISON_MIN_PARTICIPANTS
  ) {
    return null
  }

  return { participantCount, averageAccuracy, rank }
}

/** Writing section state for sectioned mocks (null for single-section mocks). */
async function getWritingSection(
  sessionId: string
): Promise<MockExamResults['writingSection']> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('mock_exam_session_sections')
    .select('writing_response, writing_submitted_for_marking')
    .eq('session_id', sessionId)
    .eq('section_key', 'writing')
    .maybeSingle()

  if (!data) {
    return null
  }

  return {
    submittedForMarking: data.writing_submitted_for_marking,
    response: data.writing_response,
  }
}
