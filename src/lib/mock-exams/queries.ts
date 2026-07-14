import { createClient } from '@/lib/supabase/server'
import {
  MOCK_EXAM_CONFIGS,
  getSectionConfig,
  resolveExamType,
  type MockExamStatus,
  type MockExamType,
  type MockSectionKey,
} from '@/lib/mock-exams/config'
import type {
  MockExamRunnerData,
  MockExamRunnerQuestion,
  MockExamSectionRow,
  MockExamSummaryRow,
  MockSectionStatus,
  SectionedMockRunnerData,
} from '@/lib/mock-exams/types'
import {
  getStudentOptionsMap,
  getStudentQuestionAssetsMap,
  getStudentStimuliMap,
} from '@/lib/practice/hydration'
import type {
  ExamType,
  QuestionOptionLabel,
  QuestionRecord,
  StudentAssetRef,
  StudentStimulus,
} from '@/lib/types'

function getRelationValue<T>(value: T | T[] | null): T | null {
  if (Array.isArray(value)) {
    return value[0] ?? null
  }

  return value ?? null
}

function shuffle<T>(items: T[]): T[] {
  const clone = [...items]
  for (let index = clone.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1))
    const current = clone[index]
    clone[index] = clone[swapIndex]
    clone[swapIndex] = current
  }
  return clone
}

export interface CandidateQuestion {
  id: string
  subject_id: string
  topic_id: string
  question_type_id: string | null
  exam_type: ExamType
  difficulty: number
  question_text: string
  passage_text: string | null
  subject: { name: string }[] | { name: string } | null
  topic: { name: string }[] | { name: string } | null
  question_type: { name: string }[] | { name: string } | null
}

/**
 * Round-robin selection across topic buckets so the set spreads over topics/types where
 * possible, with each bucket internally shuffled to randomise order. Returns up to `limit`.
 */
export function spreadAcrossTopics(candidates: CandidateQuestion[], limit: number): CandidateQuestion[] {
  const buckets = new Map<string, CandidateQuestion[]>()
  for (const candidate of shuffle(candidates)) {
    const key = candidate.topic_id
    const bucket = buckets.get(key) ?? []
    bucket.push(candidate)
    buckets.set(key, bucket)
  }

  const orderedBuckets = shuffle([...buckets.values()])
  const selected: CandidateQuestion[] = []
  let exhausted = false

  while (selected.length < limit && !exhausted) {
    exhausted = true
    for (const bucket of orderedBuckets) {
      const next = bucket.shift()
      if (next) {
        exhausted = false
        selected.push(next)
        if (selected.length >= limit) {
          break
        }
      }
    }
  }

  return selected
}

export async function fetchMockCandidates(
  examType: ExamType,
  subjectId: string | null
): Promise<CandidateQuestion[]> {
  const supabase = await createClient()
  let query = supabase
    .from('questions')
    .select(`
      id,
      subject_id,
      topic_id,
      question_type_id,
      exam_type,
      difficulty,
      question_text,
      passage_text,
      subject:subjects(name),
      topic:topics(name),
      question_type:question_types(name)
    `)
    .eq('status', 'published')
    // Randomised mocks draw from the bank only; mock-only imported questions stay out.
    .eq('origin', 'bank')
    // Mock exams are MCQ-only: never select writing prompts (extended_response).
    .eq('answer_format', 'single_choice')
    .eq('exam_type', examType)
    .limit(400)

  if (subjectId) {
    query = query.eq('subject_id', subjectId)
  }

  const { data, error } = await query

  if (error) {
    throw new Error('Unable to load mock exam questions.')
  }

  return (data ?? []) as unknown as CandidateQuestion[]
}

/** Counts how many published questions are available for a given mock configuration. */
export async function countAvailableMockQuestions(
  examType: ExamType,
  subjectId: string | null
): Promise<number> {
  const supabase = await createClient()
  let query = supabase
    .from('questions')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'published')
    .eq('origin', 'bank')
    .eq('answer_format', 'single_choice')
    .eq('exam_type', examType)

  if (subjectId) {
    query = query.eq('subject_id', subjectId)
  }

  const { count, error } = await query

  if (error) {
    throw new Error('Unable to check the available question count.')
  }

  return count ?? 0
}

interface HydratedQuestionContent {
  optionsMap: Awaited<ReturnType<typeof getStudentOptionsMap>>
  stimuliMap: Map<string, StudentStimulus>
  questionAssetsMap: Map<string, StudentAssetRef[]>
}

/** Options (with visual assets), stimuli and question assets for a set of questions. */
async function hydrateRunnerContent(
  questionIds: string[],
  stimulusIds: Array<string | null>
): Promise<HydratedQuestionContent> {
  const [optionsMap, stimuliMap, questionAssetsMap] = await Promise.all([
    getStudentOptionsMap(questionIds),
    getStudentStimuliMap(stimulusIds.filter((id): id is string => Boolean(id))),
    getStudentQuestionAssetsMap(questionIds),
  ])

  return { optionsMap, stimuliMap, questionAssetsMap }
}

export interface SelectedMockQuestion {
  questionId: string
  subjectId: string
  topicId: string
  questionTypeId: string | null
  examType: ExamType
  difficulty: number
}

/**
 * Chooses the questions for a mock exam: published only, correct exam type, optional subject,
 * spread across topics and randomised. Returns up to the target count (fewer if the bank is short).
 */
export async function selectMockExamQuestions(
  mockType: MockExamType,
  chosenExamType: ExamType,
  subjectId: string | null
): Promise<SelectedMockQuestion[]> {
  const config = MOCK_EXAM_CONFIGS[mockType]
  const examType = resolveExamType(config, chosenExamType)
  const effectiveSubjectId = config.requiresSubject ? subjectId : null

  const candidates = await fetchMockCandidates(examType, effectiveSubjectId)
  const selected = spreadAcrossTopics(candidates, config.questionCount)

  return selected.map((question) => ({
    questionId: question.id,
    subjectId: question.subject_id,
    topicId: question.topic_id,
    questionTypeId: question.question_type_id,
    examType: question.exam_type,
    difficulty: question.difficulty,
  }))
}

function computeDeadlineMs(startedAt: string, timeLimitSeconds: number): number {
  return new Date(startedAt).getTime() + timeLimitSeconds * 1000
}

export interface MockSessionRoutingMeta {
  mockType: MockExamType
  status: MockExamStatus
}

/**
 * The minimal session metadata the runner page needs to decide WHICH loader to
 * run: is it finished (→ results), and is it a sectioned `randomised_full` mock
 * (→ sectioned loader) or a flat one (→ flat loader)? Fetching this first means
 * exactly one full question-hydration path runs, instead of hydrating a
 * randomised_full session twice. Returns null when the session is missing or not
 * owned by the student (RLS also enforces ownership).
 */
export async function getMockSessionRoutingMeta(
  sessionId: string,
  studentId: string
): Promise<MockSessionRoutingMeta | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('mock_exam_sessions')
    .select('mock_type, status')
    .eq('id', sessionId)
    .eq('student_id', studentId)
    .maybeSingle()

  if (error) {
    throw new Error('Unable to load this mock exam.')
  }

  if (!data) {
    return null
  }

  return {
    mockType: data.mock_type as MockExamType,
    status: data.status as MockExamStatus,
  }
}

/**
 * Loads a mock exam session for its owner, in the client-runner shape (no correct answers).
 * Returns null when the session does not exist or is not owned by the student (RLS also enforces this).
 */
export async function getMockExamRunnerData(
  sessionId: string,
  studentId: string
): Promise<MockExamRunnerData | null> {
  const supabase = await createClient()
  const [{ data: session, error }, { data: sessionQuestions, error: questionsError }] = await Promise.all([
    supabase
      .from('mock_exam_sessions')
      .select(
        'id, student_id, mock_type, exam_type, status, time_limit_seconds, started_at, subject:subjects(name)'
      )
      .eq('id', sessionId)
      .eq('student_id', studentId)
      .maybeSingle(),
    supabase
      .from('mock_exam_session_questions')
      .select(`
        question_order,
        selected_option_label,
        is_flagged,
        question:questions(
          id,
          subject_id,
          topic_id,
          question_type_id,
          exam_type,
          difficulty,
          stimulus_id,
          question_text,
          passage_text,
          subject:subjects(name),
          topic:topics(name),
          question_type:question_types(name)
        )
      `)
      .eq('session_id', sessionId)
      .order('question_order', { ascending: true }),
  ])

  if (error) {
    throw new Error('Unable to load this mock exam.')
  }

  if (!session) {
    return null
  }

  if (questionsError) {
    throw new Error('Unable to load the questions for this mock exam.')
  }

  const rows = (sessionQuestions ?? []) as unknown as Array<{
    question_order: number
    selected_option_label: QuestionOptionLabel | null
    is_flagged: boolean
    question: (Pick<
      QuestionRecord,
      | 'id'
      | 'subject_id'
      | 'topic_id'
      | 'question_type_id'
      | 'exam_type'
      | 'difficulty'
      | 'stimulus_id'
      | 'question_text'
      | 'passage_text'
    > & {
      subject: { name: string }[] | { name: string } | null
      topic: { name: string }[] | { name: string } | null
      question_type: { name: string }[] | { name: string } | null
    })
      | null
  }>

  const validRows = rows.filter((row) => row.question !== null)
  const { optionsMap, stimuliMap, questionAssetsMap } = await hydrateRunnerContent(
    validRows.map((row) => row.question!.id),
    validRows.map((row) => row.question!.stimulus_id)
  )

  const questions: MockExamRunnerQuestion[] = validRows.map((row) => {
    const question = row.question!
    return {
      id: question.id,
      questionOrder: row.question_order,
      subjectId: question.subject_id,
      subjectName: getRelationValue(question.subject)?.name ?? 'Subject',
      topicId: question.topic_id,
      topicName: getRelationValue(question.topic)?.name ?? 'Topic',
      questionTypeId: question.question_type_id,
      questionTypeName: getRelationValue(question.question_type)?.name ?? null,
      examType: question.exam_type,
      difficulty: question.difficulty,
      questionText: question.question_text,
      passageText: question.passage_text,
      stimulus: question.stimulus_id ? stimuliMap.get(question.stimulus_id) ?? null : null,
      questionAssets: questionAssetsMap.get(question.id) ?? [],
      options: optionsMap.get(question.id) ?? [],
      selectedOptionLabel: row.selected_option_label,
      isFlagged: row.is_flagged,
    }
  })

  const sessionSubject = getRelationValue(
    (session as { subject: { name: string }[] | { name: string } | null }).subject
  )

  return {
    sessionId: session.id,
    mockType: session.mock_type as MockExamType,
    mockName: MOCK_EXAM_CONFIGS[session.mock_type as MockExamType]?.name ?? 'Mock exam',
    examType: session.exam_type as ExamType,
    subjectName: sessionSubject?.name ?? null,
    status: session.status as MockExamStatus,
    timeLimitSeconds: session.time_limit_seconds,
    startedAt: session.started_at,
    deadlineMs: computeDeadlineMs(session.started_at, session.time_limit_seconds),
    questions,
  }
}

/** Loads the ordered section rows for a sectioned mock session. */
export async function getMockExamSections(sessionId: string): Promise<MockExamSectionRow[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('mock_exam_session_sections')
    .select(
      'id, section_order, section_key, status, time_limit_seconds, break_after_seconds, started_at, submitted_at, writing_response, writing_submitted_for_marking'
    )
    .eq('session_id', sessionId)
    .order('section_order', { ascending: true })

  if (error) {
    throw new Error('Unable to load the sections for this mock exam.')
  }

  const rows = data ?? []

  const questionCounts = new Map<string, number>()
  if (rows.length) {
    const { data: questionRows } = await supabase
      .from('mock_exam_session_questions')
      .select('section_id')
      .eq('session_id', sessionId)

    for (const row of questionRows ?? []) {
      if (row.section_id) {
        questionCounts.set(row.section_id, (questionCounts.get(row.section_id) ?? 0) + 1)
      }
    }
  }

  return rows.map((row) => ({
    id: row.id,
    sectionOrder: row.section_order,
    sectionKey: row.section_key as MockSectionKey,
    name: getSectionConfig(row.section_key)?.name ?? row.section_key,
    status: row.status as MockSectionStatus,
    timeLimitSeconds: row.time_limit_seconds,
    breakAfterSeconds: row.break_after_seconds,
    startedAt: row.started_at,
    submittedAt: row.submitted_at,
    writingResponse: row.writing_response,
    writingSubmittedForMarking: row.writing_submitted_for_marking,
    questionCount: questionCounts.get(row.id) ?? 0,
  }))
}

/**
 * Loads a sectioned mock session for its owner: session header, ordered sections
 * and every MCQ question tagged with its section id (no correct answers).
 */
export async function getSectionedMockRunnerData(
  sessionId: string,
  studentId: string
): Promise<SectionedMockRunnerData | null> {
  const supabase = await createClient()
  const { data: session, error } = await supabase
    .from('mock_exam_sessions')
    .select('id, mock_type, exam_type, status, mock_test_id, mock_test:mock_tests(title)')
    .eq('id', sessionId)
    .eq('student_id', studentId)
    .maybeSingle()

  if (error) {
    throw new Error('Unable to load this mock exam.')
  }

  if (!session) {
    return null
  }

  const [sections, sessionQuestions] = await Promise.all([
    getMockExamSections(sessionId),
    supabase
      .from('mock_exam_session_questions')
      .select(`
        question_order,
        selected_option_label,
        is_flagged,
        section_id,
        question:questions(
          id,
          subject_id,
          topic_id,
          question_type_id,
          exam_type,
          difficulty,
          stimulus_id,
          question_text,
          passage_text,
          subject:subjects(name),
          topic:topics(name),
          question_type:question_types(name)
        )
      `)
      .eq('session_id', sessionId)
      .order('question_order', { ascending: true }),
  ])

  if (sessionQuestions.error) {
    throw new Error('Unable to load the questions for this mock exam.')
  }

  const rows = (sessionQuestions.data ?? []) as unknown as Array<{
    question_order: number
    selected_option_label: QuestionOptionLabel | null
    is_flagged: boolean
    section_id: string | null
    question: (Pick<
      QuestionRecord,
      | 'id'
      | 'subject_id'
      | 'topic_id'
      | 'question_type_id'
      | 'exam_type'
      | 'difficulty'
      | 'stimulus_id'
      | 'question_text'
      | 'passage_text'
    > & {
      subject: { name: string }[] | { name: string } | null
      topic: { name: string }[] | { name: string } | null
      question_type: { name: string }[] | { name: string } | null
    })
      | null
  }>

  const validRows = rows.filter((row) => row.question !== null)
  const { optionsMap, stimuliMap, questionAssetsMap } = await hydrateRunnerContent(
    validRows.map((row) => row.question!.id),
    validRows.map((row) => row.question!.stimulus_id)
  )

  const questions = validRows.map((row) => {
    const question = row.question!
    return {
      id: question.id,
      questionOrder: row.question_order,
      sectionId: row.section_id,
      subjectId: question.subject_id,
      subjectName: getRelationValue(question.subject)?.name ?? 'Subject',
      topicId: question.topic_id,
      topicName: getRelationValue(question.topic)?.name ?? 'Topic',
      questionTypeId: question.question_type_id,
      questionTypeName: getRelationValue(question.question_type)?.name ?? null,
      examType: question.exam_type,
      difficulty: question.difficulty,
      questionText: question.question_text,
      passageText: question.passage_text,
      stimulus: question.stimulus_id ? stimuliMap.get(question.stimulus_id) ?? null : null,
      questionAssets: questionAssetsMap.get(question.id) ?? [],
      options: optionsMap.get(question.id) ?? [],
      selectedOptionLabel: row.selected_option_label,
      isFlagged: row.is_flagged,
    }
  })

  const curatedTitle = getRelationValue(
    (session as { mock_test: { title: string }[] | { title: string } | null }).mock_test
  )?.title

  return {
    sessionId: session.id,
    mockName: curatedTitle ?? MOCK_EXAM_CONFIGS[session.mock_type as MockExamType]?.name ?? 'Mock exam',
    examType: session.exam_type as ExamType,
    status: session.status as MockExamStatus,
    sections,
    questions,
  }
}

function mapSummaryRow(row: {
  id: string
  mock_type: string
  exam_type: string
  status: string
  total_questions: number
  correct_count: number
  incorrect_count: number
  unanswered_count: number
  accuracy: number | null
  total_time_seconds: number
  started_at: string
  submitted_at: string | null
  created_at: string
  subject: { name: string }[] | { name: string } | null
  mock_test: { title: string }[] | { title: string } | null
}): MockExamSummaryRow {
  const curatedTitle = getRelationValue(row.mock_test)?.title
  return {
    id: row.id,
    mockType: row.mock_type as MockExamType,
    mockName: curatedTitle ?? MOCK_EXAM_CONFIGS[row.mock_type as MockExamType]?.name ?? 'Mock exam',
    examType: row.exam_type as ExamType,
    subjectName: getRelationValue(row.subject)?.name ?? null,
    status: row.status as MockExamStatus,
    totalQuestions: row.total_questions,
    correctCount: row.correct_count,
    incorrectCount: row.incorrect_count,
    unansweredCount: row.unanswered_count,
    accuracy: row.accuracy,
    totalTimeSeconds: row.total_time_seconds,
    startedAt: row.started_at,
    submittedAt: row.submitted_at,
    createdAt: row.created_at,
  }
}

const SUMMARY_COLUMNS =
  'id, mock_type, exam_type, status, total_questions, correct_count, incorrect_count, unanswered_count, accuracy, total_time_seconds, started_at, submitted_at, created_at, subject:subjects(name), mock_test:mock_tests(title)'

/** Fetches a single mock exam summary row for its owner (or staff). */
export async function getMockExamSummary(
  sessionId: string,
  studentId: string
): Promise<MockExamSummaryRow | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('mock_exam_sessions')
    .select(SUMMARY_COLUMNS)
    .eq('id', sessionId)
    .eq('student_id', studentId)
    .maybeSingle()

  if (error) {
    throw new Error('Unable to load this mock exam.')
  }

  if (!data) {
    return null
  }

  return mapSummaryRow(data as unknown as Parameters<typeof mapSummaryRow>[0])
}
