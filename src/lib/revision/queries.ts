import { startOfTodayInActivityTimezone } from '@/lib/dashboard/activity'
import { hydratePracticeQuestions, type PracticePoolQuestion } from '@/lib/practice/queries'
import { getRelationValue } from '@/lib/practice/hydration'
import { createClient } from '@/lib/supabase/server'
import type {
  AnswerFormat,
  ExamType,
  MistakeStatus,
  PracticeQuestionItem,
  QuestionRecord,
  RevisionQueueFilter,
  RevisionQueuePage,
  RevisionSummary,
  StudentMistakeQuestion,
} from '@/lib/types'

export interface RevisionQueueItem {
  question: PracticeQuestionItem
  status: MistakeStatus
  correctStreak: number
  timesIncorrect: number
  nextReviewAt: string | null
}

export interface RevisionQueue {
  items: RevisionQueueItem[]
  totalDue: number
}

/**
 * The student's due spaced-repetition queue (oldest due first), hydrated into
 * the practice question shape (no correct answers shipped to the client). Used
 * by the focused revision session runner (`/student/revision/session`).
 */
export async function getDueRevisionQueue(studentId: string, limit = 10): Promise<RevisionQueue> {
  const supabase = await createClient()
  const nowIso = new Date().toISOString()

  const { data, error, count } = await supabase
    .from('student_mistake_questions')
    .select('question_id, status, correct_streak, times_incorrect, next_review_at', {
      count: 'exact',
    })
    .eq('student_id', studentId)
    .neq('status', 'mastered')
    .not('next_review_at', 'is', null)
    .lte('next_review_at', nowIso)
    .order('next_review_at', { ascending: true })
    .limit(limit)

  if (error) {
    throw new Error('Unable to load your revision queue.')
  }

  const mistakes = data ?? []
  if (!mistakes.length) {
    return { items: [], totalDue: count ?? 0 }
  }

  const questionIds = mistakes.map((mistake) => mistake.question_id)

  const { data: questionRows, error: questionsError } = await supabase
    .from('questions')
    .select(`
      id,
      subject_id,
      topic_id,
      question_type_id,
      exam_type,
      difficulty,
      answer_format,
      stimulus_id,
      question_text,
      passage_text,
      subject:subjects(name),
      topic:topics(name),
      question_type:question_types(name)
    `)
    .in('id', questionIds)
    .eq('status', 'published')
    .is('deleted_at', null)
    // Revision retries are MCQ-only for now — writing prompts are not gradeable here.
    .eq('answer_format', 'single_choice')

  if (questionsError) {
    throw new Error('Unable to load your revision questions.')
  }

  const poolQuestions: PracticePoolQuestion[] = (
    (questionRows ?? []) as unknown as Array<
      Pick<
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
        answer_format: AnswerFormat
        stimulus_id: string | null
        subject: { name: string }[] | { name: string } | null
        topic: { name: string }[] | { name: string } | null
        question_type: { name: string }[] | { name: string } | null
      }
    >
  ).map((record) => ({
    id: record.id,
    subjectId: record.subject_id,
    subjectName: getRelationValue(record.subject)?.name ?? 'Subject',
    topicId: record.topic_id,
    topicName: getRelationValue(record.topic)?.name ?? 'Topic',
    questionTypeId: record.question_type_id,
    questionTypeName: getRelationValue(record.question_type)?.name ?? null,
    examType: record.exam_type,
    difficulty: record.difficulty,
    answerFormat: record.answer_format,
    questionText: record.question_text,
    passageText: record.passage_text,
    stimulusId: record.stimulus_id,
  }))

  const hydrated = await hydratePracticeQuestions(poolQuestions)
  const questionMap = new Map(hydrated.map((question) => [question.id, question]))

  const items: RevisionQueueItem[] = []
  for (const mistake of mistakes) {
    const question = questionMap.get(mistake.question_id)
    // Skip mistakes whose question was archived/unpublished/converted since.
    if (!question) continue

    items.push({
      question,
      status: mistake.status as MistakeStatus,
      correctStreak: mistake.correct_streak ?? 0,
      timesIncorrect: mistake.times_incorrect ?? 0,
      nextReviewAt: mistake.next_review_at,
    })
  }

  return { items, totalDue: count ?? items.length }
}

const MISTAKE_COLUMNS = `
  id,
  student_id,
  question_id,
  exam_type,
  difficulty,
  times_incorrect,
  times_correct_after_mistake,
  last_incorrect_at,
  last_attempted_at,
  status,
  next_review_at,
  correct_streak,
  last_reviewed_at,
  mastered_at,
  subject:subjects(name),
  topic:topics(name),
  question_type:question_types(name),
  question:questions(question_text)
`

type MistakeRow = {
  id: string
  student_id: string
  question_id: string
  exam_type: ExamType | null
  difficulty: number | null
  times_incorrect: number
  times_correct_after_mistake: number
  last_incorrect_at: string
  last_attempted_at: string
  status: MistakeStatus
  next_review_at: string | null
  correct_streak: number | null
  last_reviewed_at: string | null
  mastered_at: string | null
  subject: { name: string }[] | { name: string } | null
  topic: { name: string }[] | { name: string } | null
  question_type: { name: string }[] | { name: string } | null
  question: { question_text: string }[] | { question_text: string } | null
}

function mapMistakeRow(mistake: MistakeRow): StudentMistakeQuestion {
  return {
    id: mistake.id,
    studentId: mistake.student_id,
    questionId: mistake.question_id,
    subjectName: getRelationValue(mistake.subject)?.name ?? null,
    topicName: getRelationValue(mistake.topic)?.name ?? null,
    questionTypeName: getRelationValue(mistake.question_type)?.name ?? null,
    examType: mistake.exam_type,
    difficulty: mistake.difficulty,
    timesIncorrect: mistake.times_incorrect,
    timesCorrectAfterMistake: mistake.times_correct_after_mistake,
    lastIncorrectAt: mistake.last_incorrect_at,
    lastAttemptedAt: mistake.last_attempted_at,
    status: mistake.status,
    questionText: getRelationValue(mistake.question)?.question_text ?? 'Question unavailable',
    nextReviewAt: mistake.next_review_at,
    correctStreak: mistake.correct_streak ?? 0,
    lastReviewedAt: mistake.last_reviewed_at,
    masteredAt: mistake.mastered_at,
  }
}

/**
 * Accurate revision-queue bucket counts via `get_student_revision_summary`
 * (migration `student_revision_summary_and_activity_indexes`) — grouped/counted
 * in Postgres so the total is never capped by a row-fetch limit. Falls back to a
 * bounded app-side count (columns only, no relation joins) while that migration
 * is still pending.
 */
export async function getRevisionSummary(studentId: string): Promise<RevisionSummary> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .rpc('get_student_revision_summary', { p_student_id: studentId })
    .maybeSingle()

  if (!error && data) {
    const row = data as {
      overdue_count: number | string
      due_today_count: number | string
      upcoming_count: number | string
      almost_mastered_count: number | string
      mastered_count: number | string
      total_count: number | string
    }
    return {
      overdueCount: Number(row.overdue_count),
      dueTodayCount: Number(row.due_today_count),
      upcomingCount: Number(row.upcoming_count),
      almostMasteredCount: Number(row.almost_mastered_count),
      masteredCount: Number(row.mastered_count),
      totalCount: Number(row.total_count),
    }
  }

  return getRevisionSummaryFallback(studentId)
}

async function getRevisionSummaryFallback(studentId: string): Promise<RevisionSummary> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('student_mistake_questions')
    .select('status, next_review_at')
    .eq('student_id', studentId)

  if (error) {
    throw new Error('Unable to load your revision summary.')
  }

  const now = new Date()
  const nowMs = now.getTime()
  const startOfTodayMs = startOfTodayInActivityTimezone(now).getTime()
  const upcomingBoundaryMs = nowMs + 7 * 24 * 60 * 60 * 1000

  const rows = (data ?? []) as Array<{ status: MistakeStatus; next_review_at: string | null }>
  const summary: RevisionSummary = {
    overdueCount: 0,
    dueTodayCount: 0,
    upcomingCount: 0,
    almostMasteredCount: 0,
    masteredCount: 0,
    totalCount: rows.length,
  }

  for (const row of rows) {
    if (row.status === 'mastered') {
      summary.masteredCount += 1
      continue
    }
    if (row.status === 'almost_mastered') {
      summary.almostMasteredCount += 1
    }
    if (!row.next_review_at) continue
    const reviewMs = new Date(row.next_review_at).getTime()
    if (reviewMs <= nowMs) {
      if (reviewMs < startOfTodayMs) summary.overdueCount += 1
      else summary.dueTodayCount += 1
    } else if (reviewMs <= upcomingBoundaryMs) {
      summary.upcomingCount += 1
    }
  }

  return summary
}

interface RevisionQueuePageParams {
  filter: RevisionQueueFilter
  page?: number
  limit?: number
}

/**
 * The Revision page's compact queue rows — filtered and offset-paginated
 * (explicit "Load more", not infinite scroll), replacing the old unfiltered
 * `.limit(200)` fetch that silently undercounted heavy users.
 */
export async function getRevisionQueuePage(
  studentId: string,
  { filter, page = 0, limit = 20 }: RevisionQueuePageParams
): Promise<RevisionQueuePage> {
  const supabase = await createClient()
  const now = new Date()
  const nowIso = now.toISOString()
  const startOfTodayIso = startOfTodayInActivityTimezone(now).toISOString()
  const upcomingBoundaryIso = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString()

  let query = supabase
    .from('student_mistake_questions')
    .select(MISTAKE_COLUMNS, { count: 'exact' })
    .eq('student_id', studentId)

  const orderByReview = filter === 'due_now' || filter === 'overdue' || filter === 'upcoming'

  if (filter === 'due_now') {
    query = query.neq('status', 'mastered').not('next_review_at', 'is', null).lte('next_review_at', nowIso)
  } else if (filter === 'overdue') {
    query = query
      .neq('status', 'mastered')
      .not('next_review_at', 'is', null)
      .lt('next_review_at', startOfTodayIso)
  } else if (filter === 'upcoming') {
    query = query
      .neq('status', 'mastered')
      .not('next_review_at', 'is', null)
      .gt('next_review_at', nowIso)
      .lte('next_review_at', upcomingBoundaryIso)
  } else if (filter === 'mastered') {
    query = query.eq('status', 'mastered')
  }

  const from = page * limit
  const to = from + limit - 1
  query = orderByReview
    ? query.order('next_review_at', { ascending: true })
    : query.order('last_incorrect_at', { ascending: false })
  query = query.range(from, to)

  const { data, error, count } = await query

  if (error) {
    throw new Error('Unable to load your revision queue.')
  }

  const items = ((data ?? []) as unknown as MistakeRow[]).map(mapMistakeRow)
  const total = count ?? items.length

  return { items, total, hasMore: from + items.length < total }
}
