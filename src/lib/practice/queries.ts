import { getQuestionById } from '@/lib/questions/queries'
import { createClient } from '@/lib/supabase/server'
import type {
  MistakeQuestionDetail,
  PracticeSessionRecord,
  RecentPracticeSession,
  StudentMistakeQuestion,
} from '@/lib/types'

function getRelationValue<T>(value: T | T[] | null): T | null {
  if (Array.isArray(value)) {
    return value[0] ?? null
  }

  return value ?? null
}

export async function getRecentPracticeSessions(studentId: string): Promise<RecentPracticeSession[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('practice_sessions')
    .select(`
      id,
      exam_type,
      difficulty,
      total_questions,
      correct_count,
      incorrect_count,
      accuracy,
      total_time_seconds,
      completed_at,
      created_at,
      subject:subjects(name),
      topic:topics(name)
    `)
    .eq('student_id', studentId)
    .order('created_at', { ascending: false })
    .limit(6)

  if (error) {
    throw new Error('Unable to load recent practice sessions.')
  }

  return ((data ?? []) as unknown as Array<
    Pick<
      PracticeSessionRecord,
      | 'id'
      | 'exam_type'
      | 'difficulty'
      | 'total_questions'
      | 'correct_count'
      | 'incorrect_count'
      | 'accuracy'
      | 'total_time_seconds'
      | 'completed_at'
      | 'created_at'
    > & {
      subject: { name: string } | null
      topic: { name: string } | null
    }
  >).map((session) => ({
    id: session.id,
    examType: session.exam_type,
    subjectName: getRelationValue(session.subject)?.name ?? null,
    topicName: getRelationValue(session.topic)?.name ?? null,
    difficulty: session.difficulty,
    totalQuestions: session.total_questions,
    correctCount: session.correct_count,
    incorrectCount: session.incorrect_count,
    accuracy: session.accuracy,
    totalTimeSeconds: session.total_time_seconds,
    completedAt: session.completed_at,
    createdAt: session.created_at,
  }))
}

export async function getStudentMistakeQuestions(studentId: string): Promise<StudentMistakeQuestion[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('student_mistake_questions')
    .select(`
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
    `)
    .eq('student_id', studentId)
    .order('last_incorrect_at', { ascending: false })
    .limit(200)

  if (error) {
    throw new Error('Unable to load mistake questions.')
  }

  return ((data ?? []) as unknown as Array<{
    id: string
    student_id: string
    question_id: string
    exam_type: StudentMistakeQuestion['examType']
    difficulty: number | null
    times_incorrect: number
    times_correct_after_mistake: number
    last_incorrect_at: string
    last_attempted_at: string
    status: StudentMistakeQuestion['status']
    next_review_at: string | null
    correct_streak: number | null
    last_reviewed_at: string | null
    mastered_at: string | null
    subject: { name: string }[] | { name: string } | null
    topic: { name: string }[] | { name: string } | null
    question_type: { name: string }[] | { name: string } | null
    question: { question_text: string }[] | { question_text: string } | null
  }>).map((mistake) => ({
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
  }))
}

export async function getMistakeQuestionById(
  studentId: string,
  questionId: string
): Promise<MistakeQuestionDetail | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('student_mistake_questions')
    .select(`
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
      question_type:question_types(name)
    `)
    .eq('student_id', studentId)
    .eq('question_id', questionId)
    .maybeSingle()

  if (error) {
    throw new Error('Unable to load the selected revision question.')
  }

  if (!data) {
    return null
  }

  const questionDetail = await getQuestionById(questionId)

  if (!questionDetail) {
    return null
  }

  return {
    id: data.id,
    studentId: data.student_id,
    questionId: data.question_id,
    subjectName: getRelationValue(data.subject)?.name ?? questionDetail.subject.name,
    topicName: getRelationValue(data.topic)?.name ?? questionDetail.topic.name,
    questionTypeName: getRelationValue(data.question_type)?.name ?? questionDetail.questionType?.name ?? null,
    examType: data.exam_type,
    difficulty: data.difficulty,
    timesIncorrect: data.times_incorrect,
    timesCorrectAfterMistake: data.times_correct_after_mistake,
    lastIncorrectAt: data.last_incorrect_at,
    lastAttemptedAt: data.last_attempted_at,
    status: data.status,
    nextReviewAt: (data as { next_review_at: string | null }).next_review_at,
    correctStreak: (data as { correct_streak: number | null }).correct_streak ?? 0,
    lastReviewedAt: (data as { last_reviewed_at: string | null }).last_reviewed_at,
    masteredAt: (data as { mastered_at: string | null }).mastered_at,
    questionText: questionDetail.question_text,
    passageText: questionDetail.passage_text,
    shortExplanation: questionDetail.short_explanation,
    workedSolution: questionDetail.worked_solution,
    correctOptionLabel: questionDetail.correct_option_label,
    options: questionDetail.options,
  }
}
