import { hydratePracticeQuestions, type PracticePoolQuestion } from '@/lib/practice/queries'
import { getRelationValue } from '@/lib/practice/hydration'
import { createClient } from '@/lib/supabase/server'
import type {
  AnswerFormat,
  MistakeStatus,
  PracticeQuestionItem,
  QuestionRecord,
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
