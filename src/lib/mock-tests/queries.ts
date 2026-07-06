import { createClient } from '@/lib/supabase/server'
import type {
  MockTestAttemptStats,
  MockTestDetail,
  MockTestListItem,
  MockTestQuestionItem,
  MockTestSectionItem,
  MockTestSectionKey,
  MockTestStatus,
} from '@/lib/mock-tests/types'
import type {
  ExamType,
  QuestionOptionLabel,
  QuestionOptionRecord,
  QuestionStatus,
} from '@/lib/types'

function getRelationValue<T>(value: T | T[] | null): T | null {
  if (Array.isArray(value)) {
    return value[0] ?? null
  }
  return value ?? null
}

interface MockTestRow {
  id: string
  title: string
  description: string | null
  exam_type: ExamType
  year_level: number | null
  status: MockTestStatus
  published_at: string | null
  archived_at: string | null
  created_at: string
  updated_at: string
}

/** All curated mocks with section/question counts and real attempt aggregates. */
export async function getMockTests(): Promise<MockTestListItem[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('mock_tests')
    .select(`
      id, title, description, exam_type, year_level, status,
      published_at, archived_at, created_at, updated_at,
      sections:mock_test_sections(time_limit_seconds, break_after_seconds),
      questions:mock_test_questions(count)
    `)
    .order('updated_at', { ascending: false })

  if (error) {
    throw new Error('Unable to load mock tests.')
  }

  const rows = (data ?? []) as unknown as Array<
    MockTestRow & {
      sections: Array<{ time_limit_seconds: number; break_after_seconds: number }> | null
      questions: { count: number }[] | { count: number } | null
    }
  >

  // Real attempt aggregates from submitted sessions linked to curated mocks.
  const { data: sessionRows } = await supabase
    .from('mock_exam_sessions')
    .select('mock_test_id, accuracy')
    .eq('status', 'submitted')
    .not('mock_test_id', 'is', null)

  const attemptAggregates = new Map<string, { count: number; accuracySum: number; accuracyCount: number }>()
  for (const session of (sessionRows ?? []) as Array<{ mock_test_id: string; accuracy: number | null }>) {
    const entry = attemptAggregates.get(session.mock_test_id) ?? { count: 0, accuracySum: 0, accuracyCount: 0 }
    entry.count += 1
    if (session.accuracy !== null) {
      entry.accuracySum += Number(session.accuracy)
      entry.accuracyCount += 1
    }
    attemptAggregates.set(session.mock_test_id, entry)
  }

  return rows.map((row) => {
    const sections = row.sections ?? []
    const attempts = attemptAggregates.get(row.id)
    return {
      id: row.id,
      title: row.title,
      description: row.description,
      examType: row.exam_type,
      yearLevel: row.year_level,
      status: row.status,
      sectionCount: sections.length,
      questionCount: getRelationValue(row.questions)?.count ?? 0,
      estimatedDurationSeconds: sections.reduce(
        (sum, section) => sum + section.time_limit_seconds + section.break_after_seconds,
        0
      ),
      attemptsCount: attempts?.count ?? 0,
      averageAccuracy:
        attempts && attempts.accuracyCount > 0
          ? Math.round((attempts.accuracySum / attempts.accuracyCount) * 10) / 10
          : null,
      updatedAt: row.updated_at,
      createdAt: row.created_at,
    }
  })
}

interface MockQuestionJoinRow {
  id: string
  question_id: string
  section_id: string
  question_order: number
  marks: number
  question:
    | Array<MockQuestionRelationRow>
    | MockQuestionRelationRow
    | null
}

interface MockQuestionRelationRow {
  id: string
  question_text: string
  passage_text: string | null
  difficulty: number
  status: QuestionStatus
  correct_option_label: QuestionOptionLabel
  short_explanation: string | null
  worked_solution: string
  tags: string[] | null
  subject: { name: string }[] | { name: string } | null
  topic: { name: string }[] | { name: string } | null
  options: QuestionOptionRecord[] | null
}

/** Full editor payload: metadata, ordered sections, and each section's questions with answers/solutions. */
export async function getMockTestById(id: string): Promise<MockTestDetail | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('mock_tests')
    .select('id, title, description, exam_type, year_level, status, published_at, archived_at, created_at, updated_at')
    .eq('id', id)
    .maybeSingle()

  if (error) {
    throw new Error('Unable to load the mock test.')
  }
  if (!data) {
    return null
  }
  const header = data as MockTestRow

  const [{ data: sectionRows, error: sectionsError }, { data: questionRows, error: questionsError }] =
    await Promise.all([
      supabase
        .from('mock_test_sections')
        .select('id, section_order, section_key, name, subject_id, time_limit_seconds, break_after_seconds, subject:subjects(name)')
        .eq('mock_test_id', id)
        .order('section_order', { ascending: true }),
      supabase
        .from('mock_test_questions')
        .select(`
          id, question_id, section_id, question_order, marks,
          question:questions(
            id, question_text, passage_text, difficulty, status,
            correct_option_label, short_explanation, worked_solution, tags,
            subject:subjects(name),
            topic:topics(name),
            options:question_options(id, label, option_text, sort_order)
          )
        `)
        .eq('mock_test_id', id)
        .order('question_order', { ascending: true }),
    ])

  if (sectionsError || questionsError) {
    throw new Error('Unable to load the mock test contents.')
  }

  const questionsBySection = new Map<string, MockTestQuestionItem[]>()
  for (const row of (questionRows ?? []) as unknown as MockQuestionJoinRow[]) {
    const question = getRelationValue(row.question)
    if (!question) {
      continue
    }
    const items = questionsBySection.get(row.section_id) ?? []
    items.push({
      id: row.id,
      questionId: row.question_id,
      questionOrder: row.question_order,
      marks: row.marks,
      questionText: question.question_text,
      passageText: question.passage_text,
      difficulty: question.difficulty,
      questionStatus: question.status,
      subjectName: getRelationValue(question.subject)?.name ?? 'Unassigned subject',
      topicName: getRelationValue(question.topic)?.name ?? 'Unassigned topic',
      tags: question.tags ?? [],
      correctOptionLabel: question.correct_option_label,
      shortExplanation: question.short_explanation,
      workedSolution: question.worked_solution,
      options: [...(question.options ?? [])].sort((a, b) => a.sort_order - b.sort_order),
    })
    questionsBySection.set(row.section_id, items)
  }

  const sections: MockTestSectionItem[] = (
    (sectionRows ?? []) as unknown as Array<{
      id: string
      section_order: number
      section_key: MockTestSectionKey
      name: string
      subject_id: string | null
      time_limit_seconds: number
      break_after_seconds: number
      subject: { name: string }[] | { name: string } | null
    }>
  ).map((section) => ({
    id: section.id,
    sectionOrder: section.section_order,
    sectionKey: section.section_key,
    name: section.name,
    subjectId: section.subject_id,
    subjectName: getRelationValue(section.subject)?.name ?? null,
    timeLimitSeconds: section.time_limit_seconds,
    breakAfterSeconds: section.break_after_seconds,
    questions: questionsBySection.get(section.id) ?? [],
  }))

  return {
    id: header.id,
    title: header.title,
    description: header.description,
    examType: header.exam_type,
    yearLevel: header.year_level,
    status: header.status,
    publishedAt: header.published_at,
    archivedAt: header.archived_at,
    createdAt: header.created_at,
    updatedAt: header.updated_at,
    sections,
  }
}

/**
 * Real attempt statistics for one curated mock, from submitted linked
 * sessions. Per-question correctness compares each saved answer to the
 * correct label (passed in from the already-loaded detail, so nothing is
 * fetched twice). Returns zeroed stats when no sessions exist — the UI shows
 * an empty state, never fabricated numbers.
 */
export async function getMockTestAttemptStats(
  mockTestId: string,
  correctByQuestionId: Record<string, QuestionOptionLabel>
): Promise<MockTestAttemptStats> {
  const supabase = await createClient()
  const { data: sessions, error } = await supabase
    .from('mock_exam_sessions')
    .select('id, accuracy, total_time_seconds')
    .eq('mock_test_id', mockTestId)
    .eq('status', 'submitted')

  if (error) {
    throw new Error('Unable to load mock attempt statistics.')
  }

  const sessionRows = (sessions ?? []) as Array<{ id: string; accuracy: number | null; total_time_seconds: number }>
  if (sessionRows.length === 0) {
    return { attemptsCount: 0, averageAccuracy: null, averageTimeSeconds: null, perQuestion: {} }
  }

  const { data: answerRows, error: answersError } = await supabase
    .from('mock_exam_session_questions')
    .select('question_id, selected_option_label')
    .in('session_id', sessionRows.map((session) => session.id))

  if (answersError) {
    throw new Error('Unable to load mock answer statistics.')
  }

  const perQuestion: Record<string, { attempts: number; correct: number }> = {}
  for (const row of (answerRows ?? []) as Array<{ question_id: string; selected_option_label: QuestionOptionLabel | null }>) {
    const entry = perQuestion[row.question_id] ?? { attempts: 0, correct: 0 }
    entry.attempts += 1
    if (row.selected_option_label && row.selected_option_label === correctByQuestionId[row.question_id]) {
      entry.correct += 1
    }
    perQuestion[row.question_id] = entry
  }

  const accuracies = sessionRows.filter((session) => session.accuracy !== null)
  return {
    attemptsCount: sessionRows.length,
    averageAccuracy:
      accuracies.length > 0
        ? Math.round((accuracies.reduce((sum, session) => sum + Number(session.accuracy), 0) / accuracies.length) * 10) / 10
        : null,
    averageTimeSeconds: Math.round(
      sessionRows.reduce((sum, session) => sum + session.total_time_seconds, 0) / sessionRows.length
    ),
    perQuestion,
  }
}
