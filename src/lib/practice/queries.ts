import {
  getRelationValue,
  getStudentOptionsMap,
  getStudentQuestionAssetsMap,
  getStudentStimuliMap,
  sortByStimulusAdjacency,
} from '@/lib/practice/hydration'
import { createClient } from '@/lib/supabase/server'
import type {
  AnswerFormat,
  MistakeQuestionDetail,
  PracticeQuestionFilters,
  PracticeQuestionItem,
  PracticeSessionRecord,
  QuestionOptionLabel,
  QuestionRecord,
  RecentPracticeSession,
  StudentMistakeQuestion,
} from '@/lib/types'

export function shuffleArray<T>(items: T[]): T[] {
  const clone = [...items]

  for (let index = clone.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1))
    const current = clone[index]
    clone[index] = clone[swapIndex]
    clone[swapIndex] = current
  }

  return clone
}

/** A pool candidate: everything on PracticeQuestionItem except the hydrated pieces. */
export type PracticePoolQuestion = Omit<
  PracticeQuestionItem,
  'options' | 'stimulus' | 'questionAssets' | 'solutionAssets'
> & {
  stimulusId: string | null
}

const STUDENT_QUESTION_SELECT = `
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
`

type StudentQuestionRow = Pick<
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

function mapPoolQuestion(question: StudentQuestionRow): PracticePoolQuestion {
  return {
    id: question.id,
    subjectId: question.subject_id,
    subjectName: getRelationValue(question.subject)?.name ?? 'Subject',
    topicId: question.topic_id,
    topicName: getRelationValue(question.topic)?.name ?? 'Topic',
    questionTypeId: question.question_type_id,
    questionTypeName: getRelationValue(question.question_type)?.name ?? null,
    examType: question.exam_type,
    difficulty: question.difficulty,
    answerFormat: question.answer_format,
    questionText: question.question_text,
    passageText: question.passage_text,
    stimulusId: question.stimulus_id,
  }
}

/**
 * Fetches the candidate pool (up to 100 published MCQs, without options)
 * matching the practice filters. Writing prompts (extended_response) are
 * excluded — the student runners are MCQ-only for now. Callers pick from the
 * pool and hydrate the selection via hydratePracticeQuestions.
 */
export async function getPracticeQuestionPool(
  filters: Omit<PracticeQuestionFilters, 'limit'>
): Promise<PracticePoolQuestion[]> {
  const supabase = await createClient()
  let query = supabase
    .from('questions')
    .select(STUDENT_QUESTION_SELECT)
    .eq('status', 'published')
    // Mock-only imported questions never enter the student practice pool.
    .eq('origin', 'bank')
    .is('deleted_at', null)
    .eq('answer_format', 'single_choice')
    .eq('exam_type', filters.examType)
    .eq('subject_id', filters.subjectId)
    .order('created_at', { ascending: false })
    .limit(100)

  if (filters.topicId) {
    query = query.eq('topic_id', filters.topicId)
  }

  if (filters.difficulty) {
    query = query.eq('difficulty', filters.difficulty)
  }

  const { data, error } = await query

  if (error) {
    throw new Error('Unable to load practice questions.')
  }

  return ((data ?? []) as unknown as StudentQuestionRow[]).map(mapPoolQuestion)
}

/**
 * Loads specific published questions in the student-facing pool shape, preserving
 * the order of `ids`. Used by targeted subtopic practice, where the selection has
 * already been made (see `selectTargetedPractice`).
 */
export async function getPracticeQuestionsByIds(ids: string[]): Promise<PracticePoolQuestion[]> {
  if (ids.length === 0) {
    return []
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('questions')
    .select(STUDENT_QUESTION_SELECT)
    .in('id', ids)
    .eq('status', 'published')
    .is('deleted_at', null)
    .eq('answer_format', 'single_choice')

  if (error) {
    throw new Error('Unable to load practice questions.')
  }

  const byId = new Map(
    ((data ?? []) as unknown as StudentQuestionRow[]).map((question) => [question.id, mapPoolQuestion(question)])
  )

  return ids.map((id) => byId.get(id)).filter((question): question is PracticePoolQuestion => Boolean(question))
}

/**
 * Hydrates a picked set of pool questions into full PracticeQuestionItems:
 * answer options (with visual assets), the linked stimulus (with its assets)
 * and question-level assets. Questions sharing a stimulus are reordered to be
 * adjacent so students read a passage once and answer its questions together.
 */
export async function hydratePracticeQuestions(
  questions: PracticePoolQuestion[]
): Promise<PracticeQuestionItem[]> {
  const ordered = sortByStimulusAdjacency(questions, (question) => question.stimulusId)
  const questionIds = ordered.map((question) => question.id)
  const stimulusIds = ordered
    .map((question) => question.stimulusId)
    .filter((stimulusId): stimulusId is string => Boolean(stimulusId))

  const [optionsMap, stimuliMap, questionAssetsMap, solutionAssetsMap] = await Promise.all([
    getStudentOptionsMap(questionIds),
    getStudentStimuliMap(stimulusIds),
    getStudentQuestionAssetsMap(questionIds),
    getStudentQuestionAssetsMap(questionIds, 'solution'),
  ])

  return ordered.map(({ stimulusId, ...question }) => ({
    ...question,
    stimulus: stimulusId ? stimuliMap.get(stimulusId) ?? null : null,
    questionAssets: questionAssetsMap.get(question.id) ?? [],
    solutionAssets: solutionAssetsMap.get(question.id) ?? [],
    options: optionsMap.get(question.id) ?? [],
  }))
}

/**
 * Fetches a single PUBLISHED question in the student-facing practice shape
 * (no correct answer), fully hydrated. Used to retry a tracked mistake.
 */
export async function getStudentPracticeQuestion(
  questionId: string
): Promise<PracticeQuestionItem | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('questions')
    .select(STUDENT_QUESTION_SELECT)
    .eq('id', questionId)
    .eq('status', 'published')
    .is('deleted_at', null)
    .maybeSingle()

  if (error) {
    throw new Error('Unable to load the question for revision.')
  }

  if (!data) {
    return null
  }

  const [question] = await hydratePracticeQuestions([
    mapPoolQuestion(data as unknown as StudentQuestionRow),
  ])

  return question ?? null
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

  const { data: questionData, error: questionError } = await supabase
    .from('questions')
    .select(
      'id, question_text, passage_text, short_explanation, worked_solution, correct_option_label, answer_format, stimulus_id'
    )
    .eq('id', questionId)
    .maybeSingle()

  if (questionError) {
    throw new Error('Unable to load the selected revision question.')
  }

  if (!questionData) {
    return null
  }

  const question = questionData as unknown as {
    id: string
    question_text: string
    passage_text: string | null
    short_explanation: string | null
    worked_solution: string | null
    correct_option_label: QuestionOptionLabel | null
    answer_format: AnswerFormat
    stimulus_id: string | null
  }

  // Mistake review is MCQ-only: a question without an answer key (e.g. a
  // writing prompt) cannot be revised here, so treat it as unavailable.
  if (question.answer_format !== 'single_choice' || !question.correct_option_label) {
    return null
  }

  const [optionsMap, stimuliMap, questionAssetsMap] = await Promise.all([
    getStudentOptionsMap([questionId]),
    getStudentStimuliMap(question.stimulus_id ? [question.stimulus_id] : []),
    getStudentQuestionAssetsMap([questionId]),
  ])

  return {
    id: data.id,
    studentId: data.student_id,
    questionId: data.question_id,
    subjectName: getRelationValue(data.subject)?.name ?? null,
    topicName: getRelationValue(data.topic)?.name ?? null,
    questionTypeName: getRelationValue(data.question_type)?.name ?? null,
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
    questionText: question.question_text,
    passageText: question.passage_text,
    stimulus: question.stimulus_id ? stimuliMap.get(question.stimulus_id) ?? null : null,
    questionAssets: questionAssetsMap.get(questionId) ?? [],
    shortExplanation: question.short_explanation,
    workedSolution: question.worked_solution ?? question.short_explanation ?? '',
    correctOptionLabel: question.correct_option_label,
    options: optionsMap.get(questionId) ?? [],
  }
}
