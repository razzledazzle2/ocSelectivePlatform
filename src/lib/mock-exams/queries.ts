import { createClient } from '@/lib/supabase/server'
import {
  MOCK_EXAM_CONFIGS,
  resolveExamType,
  type MockExamStatus,
  type MockExamType,
} from '@/lib/mock-exams/config'
import type {
  MockExamRunnerData,
  MockExamRunnerQuestion,
  MockExamSummaryRow,
} from '@/lib/mock-exams/types'
import type {
  ExamType,
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

interface CandidateQuestion {
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
function spreadAcrossTopics(candidates: CandidateQuestion[], limit: number): CandidateQuestion[] {
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

async function fetchMockCandidates(
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

async function getOptionsMap(questionIds: string[]): Promise<Map<string, QuestionOptionRecord[]>> {
  if (!questionIds.length) {
    return new Map()
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('question_options')
    .select('id, question_id, label, option_text, sort_order, created_at')
    .in('question_id', questionIds)
    .order('sort_order', { ascending: true })

  if (error) {
    throw new Error('Unable to load mock exam question options.')
  }

  const map = new Map<string, QuestionOptionRecord[]>()
  for (const option of (data ?? []) as Array<QuestionOptionRecord & { question_id: string }>) {
    const existing = map.get(option.question_id) ?? []
    existing.push(option)
    map.set(option.question_id, existing)
  }
  return map
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

/**
 * Loads a mock exam session for its owner, in the client-runner shape (no correct answers).
 * Returns null when the session does not exist or is not owned by the student (RLS also enforces this).
 */
export async function getMockExamRunnerData(
  sessionId: string,
  studentId: string
): Promise<MockExamRunnerData | null> {
  const supabase = await createClient()
  const { data: session, error } = await supabase
    .from('mock_exam_sessions')
    .select(
      'id, student_id, mock_type, exam_type, status, time_limit_seconds, started_at, subject:subjects(name)'
    )
    .eq('id', sessionId)
    .eq('student_id', studentId)
    .maybeSingle()

  if (error) {
    throw new Error('Unable to load this mock exam.')
  }

  if (!session) {
    return null
  }

  const { data: sessionQuestions, error: questionsError } = await supabase
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
        question_text,
        passage_text,
        subject:subjects(name),
        topic:topics(name),
        question_type:question_types(name)
      )
    `)
    .eq('session_id', sessionId)
    .order('question_order', { ascending: true })

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
  const optionsMap = await getOptionsMap(validRows.map((row) => row.question!.id))

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
}): MockExamSummaryRow {
  return {
    id: row.id,
    mockType: row.mock_type as MockExamType,
    mockName: MOCK_EXAM_CONFIGS[row.mock_type as MockExamType]?.name ?? 'Mock exam',
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
  'id, mock_type, exam_type, status, total_questions, correct_count, incorrect_count, unanswered_count, accuracy, total_time_seconds, started_at, submitted_at, created_at, subject:subjects(name)'

/** Recent mock exam attempts for the landing page. */
export async function getRecentMockExams(
  studentId: string,
  limit = 8
): Promise<MockExamSummaryRow[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('mock_exam_sessions')
    .select(SUMMARY_COLUMNS)
    .eq('student_id', studentId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    throw new Error('Unable to load your recent mock exams.')
  }

  return ((data ?? []) as unknown as Parameters<typeof mapSummaryRow>[0][]).map(mapSummaryRow)
}

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
