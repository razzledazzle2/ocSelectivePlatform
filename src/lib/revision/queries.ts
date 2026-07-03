import { createClient } from '@/lib/supabase/server'
import type {
  MistakeStatus,
  PracticeQuestionItem,
  QuestionOptionRecord,
} from '@/lib/types'

function getRelationValue<T>(value: T | T[] | null): T | null {
  if (Array.isArray(value)) {
    return value[0] ?? null
  }

  return value ?? null
}

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
 * the practice question shape (no correct answers shipped to the client).
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

  const [questionsResult, optionsResult] = await Promise.all([
    supabase
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
      .in('id', questionIds)
      .eq('status', 'published'),
    supabase
      .from('question_options')
      .select('id, question_id, label, option_text, sort_order, created_at')
      .in('question_id', questionIds)
      .order('sort_order', { ascending: true }),
  ])

  if (questionsResult.error || optionsResult.error) {
    throw new Error('Unable to load your revision questions.')
  }

  const optionsMap = new Map<string, QuestionOptionRecord[]>()
  for (const option of (optionsResult.data ?? []) as Array<QuestionOptionRecord & { question_id: string }>) {
    const existing = optionsMap.get(option.question_id) ?? []
    existing.push(option)
    optionsMap.set(option.question_id, existing)
  }

  const questionMap = new Map(
    (questionsResult.data ?? []).map((question) => {
      const record = question as unknown as {
        id: string
        subject_id: string
        topic_id: string
        question_type_id: string | null
        exam_type: PracticeQuestionItem['examType']
        difficulty: number
        question_text: string
        passage_text: string | null
        subject: { name: string }[] | { name: string } | null
        topic: { name: string }[] | { name: string } | null
        question_type: { name: string }[] | { name: string } | null
      }

      const item: PracticeQuestionItem = {
        id: record.id,
        subjectId: record.subject_id,
        subjectName: getRelationValue(record.subject)?.name ?? 'Subject',
        topicId: record.topic_id,
        topicName: getRelationValue(record.topic)?.name ?? 'Topic',
        questionTypeId: record.question_type_id,
        questionTypeName: getRelationValue(record.question_type)?.name ?? null,
        examType: record.exam_type,
        difficulty: record.difficulty,
        questionText: record.question_text,
        passageText: record.passage_text,
        options: optionsMap.get(record.id) ?? [],
      }

      return [record.id, item] as const
    })
  )

  const items: RevisionQueueItem[] = []
  for (const mistake of mistakes) {
    const question = questionMap.get(mistake.question_id)
    // Skip mistakes whose question was archived/unpublished since.
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
