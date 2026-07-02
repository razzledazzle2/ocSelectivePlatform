import { createClient } from '@/lib/supabase/server'
import type {
  AdminQuestionFilters,
  AdminQuestionListItem,
  PracticeQuestionFilters,
  PracticeQuestionItem,
  QuestionDetail,
  QuestionOptionRecord,
  QuestionRecord,
  QuestionTypeRecord,
  SubjectRecord,
  TopicRecord,
} from '@/lib/types'

function getRelationValue<T>(value: T | T[] | null): T | null {
  if (Array.isArray(value)) {
    return value[0] ?? null
  }

  return value ?? null
}

function buildQuestionPreview(questionText: string): string {
  const collapsed = questionText.replace(/\s+/g, ' ').trim()
  return collapsed.length > 110 ? `${collapsed.slice(0, 107)}...` : collapsed
}

async function getQuestionOptionsMap(questionIds: string[]): Promise<Map<string, QuestionOptionRecord[]>> {
  if (!questionIds.length) {
    return new Map()
  }

  const supabase = createClient()
  const { data, error } = await supabase
    .from('question_options')
    .select('id, question_id, label, option_text, sort_order, created_at')
    .in('question_id', questionIds)
    .order('sort_order', { ascending: true })

  if (error) {
    throw new Error('Unable to load question options.')
  }

  const optionsMap = new Map<string, QuestionOptionRecord[]>()

  for (const option of (data ?? []) as Array<QuestionOptionRecord & { question_id: string }>) {
    const existing = optionsMap.get(option.question_id) ?? []
    existing.push(option)
    optionsMap.set(option.question_id, existing)
  }

  return optionsMap
}

export async function getSubjects(): Promise<SubjectRecord[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('subjects')
    .select('id, name, slug, description, sort_order, is_active, created_at, updated_at')
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true })

  if (error) {
    throw new Error('Unable to load subjects.')
  }

  return (data ?? []) as SubjectRecord[]
}

export async function getTopicsBySubject(subjectId?: string): Promise<TopicRecord[]> {
  const supabase = createClient()
  let query = supabase
    .from('topics')
    .select('id, subject_id, name, slug, description, sort_order, is_active, created_at, updated_at')
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true })

  if (subjectId) {
    query = query.eq('subject_id', subjectId)
  }

  const { data, error } = await query

  if (error) {
    throw new Error('Unable to load topics.')
  }

  return (data ?? []) as TopicRecord[]
}

export async function getQuestionTypesBySubject(subjectId: string): Promise<QuestionTypeRecord[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('question_types')
    .select('id, subject_id, topic_id, name, slug, description, sort_order, is_active, created_at, updated_at')
    .eq('subject_id', subjectId)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true })

  if (error) {
    throw new Error('Unable to load question types.')
  }

  return (data ?? []) as QuestionTypeRecord[]
}

export async function getQuestionTypes(): Promise<QuestionTypeRecord[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('question_types')
    .select('id, subject_id, topic_id, name, slug, description, sort_order, is_active, created_at, updated_at')
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true })

  if (error) {
    throw new Error('Unable to load question types.')
  }

  return (data ?? []) as QuestionTypeRecord[]
}

export async function getQuestionTypesByTopic(topicId: string): Promise<QuestionTypeRecord[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('question_types')
    .select('id, subject_id, topic_id, name, slug, description, sort_order, is_active, created_at, updated_at')
    .eq('topic_id', topicId)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true })

  if (error) {
    throw new Error('Unable to load question types.')
  }

  return (data ?? []) as QuestionTypeRecord[]
}

export async function getAdminQuestions(filters: AdminQuestionFilters = {}): Promise<AdminQuestionListItem[]> {
  const supabase = createClient()
  let query = supabase
    .from('questions')
    .select(`
      id,
      question_text,
      exam_type,
      difficulty,
      status,
      created_at,
      updated_at,
      published_at,
      archived_at,
      subject:subjects(name),
      topic:topics(name),
      question_type:question_types(name)
    `)
    .order('created_at', { ascending: false })

  if (filters.examType) {
    query = query.eq('exam_type', filters.examType)
  }

  if (filters.subjectId) {
    query = query.eq('subject_id', filters.subjectId)
  }

  if (filters.topicId) {
    query = query.eq('topic_id', filters.topicId)
  }

  if (filters.difficulty) {
    query = query.eq('difficulty', Number(filters.difficulty))
  }

  if (filters.status) {
    query = query.eq('status', filters.status)
  }

  if (filters.query) {
    query = query.ilike('question_text', `%${filters.query.trim()}%`)
  }

  const { data, error } = await query

  if (error) {
    throw new Error('Unable to load admin questions.')
  }

  return ((data ?? []) as unknown as Array<
    Pick<
      QuestionRecord,
      'id' | 'question_text' | 'exam_type' | 'difficulty' | 'status' | 'created_at' | 'updated_at' | 'published_at' | 'archived_at'
    > & {
      subject: { name: string }[] | { name: string } | null
      topic: { name: string }[] | { name: string } | null
      question_type: { name: string }[] | { name: string } | null
    }
  >).map((question) => ({
    id: question.id,
    questionTextPreview: buildQuestionPreview(question.question_text),
    subjectName: getRelationValue(question.subject)?.name ?? 'Unassigned subject',
    topicName: getRelationValue(question.topic)?.name ?? 'Unassigned topic',
    questionTypeName: getRelationValue(question.question_type)?.name ?? null,
    examType: question.exam_type,
    difficulty: question.difficulty,
    status: question.status,
    createdAt: question.created_at,
    updatedAt: question.updated_at,
    publishedAt: question.published_at,
    archivedAt: question.archived_at,
  }))
}

export async function getQuestionById(id: string): Promise<QuestionDetail | null> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('questions')
    .select(`
      *,
      subject:subjects(*),
      topic:topics(*),
      question_type:question_types(*)
    `)
    .eq('id', id)
    .maybeSingle()

  if (error) {
    throw new Error('Unable to load question details.')
  }

  if (!data) {
    return null
  }

  const optionsMap = await getQuestionOptionsMap([id])
  const question = data as QuestionRecord & {
    subject: SubjectRecord[] | SubjectRecord | null
    topic: TopicRecord[] | TopicRecord | null
    question_type: QuestionTypeRecord[] | QuestionTypeRecord | null
  }
  const subject = getRelationValue(question.subject)
  const topic = getRelationValue(question.topic)

  return {
    ...question,
    subject: subject ?? {
      id: question.subject_id,
      name: 'Subject',
      slug: 'subject',
      description: null,
      sort_order: 0,
      is_active: true,
    },
    topic: topic ?? {
      id: question.topic_id,
      subject_id: question.subject_id,
      name: 'Topic',
      slug: 'topic',
      description: null,
      sort_order: 0,
      is_active: true,
    },
    questionType: getRelationValue(question.question_type),
    options: optionsMap.get(id) ?? [],
  }
}

function shuffleArray<T>(items: T[]): T[] {
  const clone = [...items]

  for (let index = clone.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1))
    const current = clone[index]
    clone[index] = clone[swapIndex]
    clone[swapIndex] = current
  }

  return clone
}

export async function getPracticeQuestions(filters: PracticeQuestionFilters): Promise<PracticeQuestionItem[]> {
  const supabase = createClient()
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

  const questions = (data ?? []) as unknown as Array<
    Pick<
      QuestionRecord,
      'id' | 'subject_id' | 'topic_id' | 'question_type_id' | 'exam_type' | 'difficulty' | 'question_text' | 'passage_text'
    > & {
      subject: { name: string }[] | { name: string } | null
      topic: { name: string }[] | { name: string } | null
      question_type: { name: string }[] | { name: string } | null
    }
  >
  const selectedQuestions = shuffleArray(questions).slice(0, filters.limit)
  const optionsMap = await getQuestionOptionsMap(selectedQuestions.map((question) => question.id))

  return selectedQuestions.map((question) => ({
    id: question.id,
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
  }))
}
