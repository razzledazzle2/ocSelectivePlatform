import { createClient } from '@/lib/supabase/server'
import type {
  CoverageBucket,
  MockProgramCoverage,
  MockSubjectShare,
  MockTestAttemptStats,
  MockTestDetail,
  MockTestListItem,
  MockTestQuestionItem,
  MockTestSectionItem,
  MockTestSectionKey,
  MockTestStatus,
  MockType,
  StudentMockListItem,
} from '@/lib/mock-tests/types'
import type {
  AnswerFormat,
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
  mock_type: MockType
  instructions: string | null
  difficulty_label: string | null
  display_order: number
  published_at: string | null
  archived_at: string | null
  created_at: string
  updated_at: string
}

const MOCK_TEST_HEADER_COLUMNS =
  'id, title, description, exam_type, year_level, status, mock_type, instructions, difficulty_label, display_order, published_at, archived_at, created_at, updated_at'

/** Ordered subject breakdown (largest share first) from a flat list of subject names. */
function toSubjectMix(subjectNames: string[]): MockSubjectShare[] {
  const counts = new Map<string, number>()
  for (const name of subjectNames) {
    counts.set(name, (counts.get(name) ?? 0) + 1)
  }
  return [...counts.entries()]
    .map(([subjectName, count]) => ({ subjectName, count }))
    .sort((a, b) => b.count - a.count || a.subjectName.localeCompare(b.subjectName))
}

/** All curated mocks with section/question counts, subject mix and real attempt aggregates. */
export async function getMockTests(): Promise<MockTestListItem[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('mock_tests')
    .select(`
      ${MOCK_TEST_HEADER_COLUMNS},
      sections:mock_test_sections(time_limit_seconds, break_after_seconds),
      questions:mock_test_questions(count)
    `)
    .order('display_order', { ascending: true })
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
  // Subject mix from the linked bank questions of every mock in one query.
  const [{ data: sessionRows }, { data: mixRows }] = await Promise.all([
    supabase
      .from('mock_exam_sessions')
      .select('mock_test_id, accuracy')
      .eq('status', 'submitted')
      .not('mock_test_id', 'is', null),
    supabase
      .from('mock_test_questions')
      .select('mock_test_id, question:questions(subject:subjects(name))'),
  ])

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

  const subjectNamesByMock = new Map<string, string[]>()
  for (const row of (mixRows ?? []) as Array<{
    mock_test_id: string
    question: { subject: { name: string }[] | { name: string } | null }[] | { subject: { name: string }[] | { name: string } | null } | null
  }>) {
    const question = getRelationValue(row.question)
    const subjectName = getRelationValue(question?.subject ?? null)?.name
    if (!subjectName) {
      continue
    }
    const list = subjectNamesByMock.get(row.mock_test_id) ?? []
    list.push(subjectName)
    subjectNamesByMock.set(row.mock_test_id, list)
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
      mockType: row.mock_type,
      difficultyLabel: row.difficulty_label,
      displayOrder: row.display_order,
      sectionCount: sections.length,
      questionCount: getRelationValue(row.questions)?.count ?? 0,
      estimatedDurationSeconds: sections.reduce(
        (sum, section) => sum + section.time_limit_seconds + section.break_after_seconds,
        0
      ),
      subjectMix: toSubjectMix(subjectNamesByMock.get(row.id) ?? []),
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
  answer_format: AnswerFormat
  correct_option_label: QuestionOptionLabel | null
  short_explanation: string | null
  worked_solution: string | null
  tags: string[] | null
  skill_tags: string[] | null
  concept_tags: string[] | null
  variant_id: string | null
  stimulus_id: string | null
  deleted_at: string | null
  subject: { name: string }[] | { name: string } | null
  topic: { name: string }[] | { name: string } | null
  question_type: { name: string }[] | { name: string } | null
  options: QuestionOptionRecord[] | null
  question_assets: { count: number }[] | { count: number } | null
}

/** Full editor payload: metadata, ordered sections, and each section's questions with answers/solutions. */
export async function getMockTestById(id: string): Promise<MockTestDetail | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('mock_tests')
    .select(MOCK_TEST_HEADER_COLUMNS)
    .eq('id', id)
    .maybeSingle()

  if (error) {
    throw new Error('Unable to load the mock test.')
  }
  if (!data) {
    return null
  }
  const header = data as unknown as MockTestRow

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
            id, question_text, passage_text, difficulty, status, answer_format,
            correct_option_label, short_explanation, worked_solution,
            tags, skill_tags, concept_tags, variant_id, stimulus_id, deleted_at,
            subject:subjects(name),
            topic:topics(name),
            question_type:question_types(name),
            options:question_options(id, label, option_text, sort_order),
            question_assets:question_assets(count)
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
      questionTypeName: getRelationValue(question.question_type)?.name ?? null,
      answerFormat: question.answer_format,
      tags: question.tags ?? [],
      skillTags: question.skill_tags ?? [],
      conceptTags: question.concept_tags ?? [],
      variantId: question.variant_id,
      stimulusId: question.stimulus_id,
      hasAssets: (getRelationValue(question.question_assets)?.count ?? 0) > 0,
      deletedAt: question.deleted_at,
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
    mockType: header.mock_type,
    instructions: header.instructions,
    difficultyLabel: header.difficulty_label,
    displayOrder: header.display_order,
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

/**
 * Published curated mocks for the student list, each tagged with THIS student's
 * own progress. RLS already restricts mock_tests to published rows for students,
 * but the status filter keeps staff previews honest too. A mock with an
 * in-progress session shows as "Continue"; otherwise a submitted session shows
 * as "Review"; otherwise "Start".
 */
export async function getPublishedMocksForStudent(studentId: string): Promise<StudentMockListItem[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('mock_tests')
    .select(`
      ${MOCK_TEST_HEADER_COLUMNS},
      sections:mock_test_sections(time_limit_seconds, break_after_seconds),
      questions:mock_test_questions(question:questions(subject:subjects(name)))
    `)
    .eq('status', 'published')
    .order('display_order', { ascending: true })
    .order('published_at', { ascending: false })

  if (error) {
    throw new Error('Unable to load mock tests.')
  }

  const rows = (data ?? []) as unknown as Array<
    MockTestRow & {
      sections: Array<{ time_limit_seconds: number; break_after_seconds: number }> | null
      questions: Array<{
        question: { subject: { name: string }[] | { name: string } | null }[] | { subject: { name: string }[] | { name: string } | null } | null
      }> | null
    }
  >

  const mockIds = rows.map((row) => row.id)

  // This student's sessions for these mocks, newest first.
  const sessionsByMock = new Map<
    string,
    Array<{ id: string; status: string; accuracy: number | null; submitted_at: string | null }>
  >()
  if (mockIds.length > 0) {
    const { data: sessions } = await supabase
      .from('mock_exam_sessions')
      .select('id, mock_test_id, status, accuracy, submitted_at, created_at')
      .eq('student_id', studentId)
      .in('mock_test_id', mockIds)
      .order('created_at', { ascending: false })

    for (const session of (sessions ?? []) as Array<{
      id: string
      mock_test_id: string
      status: string
      accuracy: number | null
      submitted_at: string | null
    }>) {
      const list = sessionsByMock.get(session.mock_test_id) ?? []
      list.push(session)
      sessionsByMock.set(session.mock_test_id, list)
    }
  }

  return rows.map((row) => {
    const sections = row.sections ?? []
    const subjectNames: string[] = []
    let questionCount = 0
    for (const link of row.questions ?? []) {
      questionCount += 1
      const question = getRelationValue(link.question)
      const subjectName = getRelationValue(question?.subject ?? null)?.name
      if (subjectName) {
        subjectNames.push(subjectName)
      }
    }

    const sessions = sessionsByMock.get(row.id) ?? []
    const inProgress = sessions.find((session) => session.status === 'in_progress')
    const submitted = sessions.find((session) => session.status === 'submitted')

    let attemptStatus: StudentMockListItem['attemptStatus'] = 'not_started'
    let sessionId: string | null = null
    let score: number | null = null
    let completedAt: string | null = null

    if (inProgress) {
      attemptStatus = 'in_progress'
      sessionId = inProgress.id
    } else if (submitted) {
      attemptStatus = 'completed'
      sessionId = submitted.id
      score = submitted.accuracy
      completedAt = submitted.submitted_at
    }

    return {
      id: row.id,
      title: row.title,
      description: row.description,
      examType: row.exam_type,
      yearLevel: row.year_level,
      mockType: row.mock_type,
      difficultyLabel: row.difficulty_label,
      questionCount,
      estimatedDurationSeconds: sections.reduce(
        (sum, section) => sum + section.time_limit_seconds + section.break_after_seconds,
        0
      ),
      subjectMix: toSubjectMix(subjectNames),
      attemptStatus,
      sessionId,
      score,
      completedAt,
    }
  })
}

export interface MockProgramFilters {
  examType?: string
  yearLevel?: string
  mockType?: string
}

/**
 * Coverage across every published curated mock — the admin program dashboard.
 * Counts question SLOTS (a question reused in two mocks counts twice) for
 * distribution, but reports distinctQuestionsUsed separately. "Never used"
 * topics are active topics that appear in no published mock; "overused" are
 * topics that appear in a majority of published mocks.
 */
export async function getMockProgramCoverage(
  filters: MockProgramFilters = {}
): Promise<MockProgramCoverage> {
  const supabase = await createClient()

  let mockQuery = supabase
    .from('mock_tests')
    .select('id, mock_type, exam_type, year_level')
    .eq('status', 'published')

  if (filters.examType) {
    mockQuery = mockQuery.eq('exam_type', filters.examType)
  }
  if (filters.mockType) {
    mockQuery = mockQuery.eq('mock_type', filters.mockType)
  }
  if (filters.yearLevel) {
    mockQuery = mockQuery.eq('year_level', Number(filters.yearLevel))
  }

  const [{ data: mockRows, error: mockError }, { data: topicRows, error: topicError }] = await Promise.all([
    mockQuery,
    supabase
      .from('topics')
      .select('id, name, is_active, subject:subjects(name)')
      .eq('is_active', true),
  ])

  if (mockError || topicError) {
    throw new Error('Unable to load mock coverage.')
  }

  const mocks = (mockRows ?? []) as Array<{ id: string; mock_type: MockType; exam_type: ExamType; year_level: number | null }>
  const publishedMockCount = mocks.length
  const mockIds = mocks.map((mock) => mock.id)

  const byMockType = new Map<string, number>()
  for (const mock of mocks) {
    byMockType.set(mock.mock_type, (byMockType.get(mock.mock_type) ?? 0) + 1)
  }

  const topicMeta = new Map<string, { name: string; subjectName: string }>()
  for (const topic of (topicRows ?? []) as Array<{
    id: string
    name: string
    subject: { name: string }[] | { name: string } | null
  }>) {
    topicMeta.set(topic.id, {
      name: topic.name,
      subjectName: getRelationValue(topic.subject)?.name ?? 'Unassigned subject',
    })
  }

  // Every linked question of the published mocks, with metadata for distribution.
  const subjectCounts = new Map<string, number>()
  const difficultyCounts = new Map<string, number>()
  const topicMockSet = new Map<string, Set<string>>()
  const topicQuestionCount = new Map<string, number>()
  const distinctQuestions = new Set<string>()
  let totalQuestionSlots = 0

  if (mockIds.length > 0) {
    const { data: linkRows, error: linkError } = await supabase
      .from('mock_test_questions')
      .select(
        'mock_test_id, question_id, question:questions(topic_id, difficulty, subject:subjects(name))'
      )
      .in('mock_test_id', mockIds)

    if (linkError) {
      throw new Error('Unable to load mock coverage questions.')
    }

    for (const link of (linkRows ?? []) as Array<{
      mock_test_id: string
      question_id: string
      question:
        | { topic_id: string | null; difficulty: number; subject: { name: string }[] | { name: string } | null }[]
        | { topic_id: string | null; difficulty: number; subject: { name: string }[] | { name: string } | null }
        | null
    }>) {
      const question = getRelationValue(link.question)
      if (!question) {
        continue
      }
      totalQuestionSlots += 1
      distinctQuestions.add(link.question_id)

      const subjectName = getRelationValue(question.subject)?.name ?? 'Unassigned subject'
      subjectCounts.set(subjectName, (subjectCounts.get(subjectName) ?? 0) + 1)

      const difficultyKey = `D${question.difficulty}`
      difficultyCounts.set(difficultyKey, (difficultyCounts.get(difficultyKey) ?? 0) + 1)

      if (question.topic_id) {
        topicQuestionCount.set(question.topic_id, (topicQuestionCount.get(question.topic_id) ?? 0) + 1)
        const set = topicMockSet.get(question.topic_id) ?? new Set<string>()
        set.add(link.mock_test_id)
        topicMockSet.set(question.topic_id, set)
      }
    }
  }

  const topicUsage = [...topicQuestionCount.entries()]
    .map(([topicId, questionCount]) => ({
      topicId,
      topicName: topicMeta.get(topicId)?.name ?? 'Unknown topic',
      subjectName: topicMeta.get(topicId)?.subjectName ?? 'Unassigned subject',
      mockCount: topicMockSet.get(topicId)?.size ?? 0,
      questionCount,
    }))
    .sort((a, b) => b.questionCount - a.questionCount)

  const neverUsedTopics = [...topicMeta.entries()]
    .filter(([topicId]) => !topicQuestionCount.has(topicId))
    .map(([topicId, meta]) => ({ topicId, topicName: meta.name, subjectName: meta.subjectName }))
    .sort((a, b) => a.subjectName.localeCompare(b.subjectName) || a.topicName.localeCompare(b.topicName))

  const overuseThreshold = Math.max(2, Math.ceil(publishedMockCount * 0.6))
  const overusedTopics = topicUsage.filter((topic) => topic.mockCount >= overuseThreshold)

  const toBuckets = (map: Map<string, number>): CoverageBucket[] =>
    [...map.entries()].map(([key, count]) => ({ key, label: key, count })).sort((a, b) => b.count - a.count)

  const difficultyBuckets = ['D1', 'D2', 'D3', 'D4', 'D5']
    .filter((key) => difficultyCounts.has(key))
    .map((key) => ({ key, label: key, count: difficultyCounts.get(key) ?? 0 }))

  return {
    publishedMockCount,
    totalQuestionSlots,
    distinctQuestionsUsed: distinctQuestions.size,
    bySubject: toBuckets(subjectCounts),
    byDifficulty: difficultyBuckets,
    byMockType: [...byMockType.entries()]
      .map(([key, count]) => ({ key, label: key, count }))
      .sort((a, b) => b.count - a.count),
    topicUsage,
    neverUsedTopics,
    overusedTopics,
  }
}
