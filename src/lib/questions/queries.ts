import { getAdminQuestionStats } from '@/lib/questions/stats'
import { createClient } from '@/lib/supabase/server'
import {
  ADMIN_QUESTION_PAGE_SIZES,
  ADMIN_QUESTION_SORTS,
  DEFAULT_ADMIN_QUESTION_PAGE_SIZE,
  type AdminQuestionFilters,
  type AdminQuestionListItem,
  type AdminQuestionsPage,
  type AdminQuestionSort,
  type PracticeQuestionFilters,
  type PracticeQuestionItem,
  type QuestionDetail,
  type QuestionOptionLabel,
  type QuestionOptionRecord,
  type QuestionRecord,
  type QuestionTypeRecord,
  type SubjectRecord,
  type TopicRecord,
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

  const supabase = await createClient()
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
  const supabase = await createClient()
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
  const supabase = await createClient()
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
  const supabase = await createClient()
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
  const supabase = await createClient()
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
  const supabase = await createClient()
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

type AdminQuestionRawRow = Pick<
  QuestionRecord,
  | 'id'
  | 'question_text'
  | 'exam_type'
  | 'difficulty'
  | 'status'
  | 'correct_option_label'
  | 'created_at'
  | 'updated_at'
  | 'published_at'
  | 'archived_at'
> & {
  tags: string[] | null
  subject: { name: string }[] | { name: string } | null
  topic: { name: string }[] | { name: string } | null
  question_type: { name: string }[] | { name: string } | null
  options: { count: number }[] | { count: number } | null
}

const ADMIN_QUESTION_LIST_SELECT = `
  id,
  question_text,
  exam_type,
  difficulty,
  status,
  correct_option_label,
  tags,
  created_at,
  updated_at,
  published_at,
  archived_at,
  subject:subjects(name),
  topic:topics(name),
  question_type:question_types(name),
  options:question_options(count)
`

function mapAdminQuestionRow(question: AdminQuestionRawRow): AdminQuestionListItem {
  return {
    id: question.id,
    questionTextPreview: buildQuestionPreview(question.question_text),
    subjectName: getRelationValue(question.subject)?.name ?? 'Unassigned subject',
    topicName: getRelationValue(question.topic)?.name ?? 'Unassigned topic',
    questionTypeName: getRelationValue(question.question_type)?.name ?? null,
    examType: question.exam_type,
    difficulty: question.difficulty,
    status: question.status,
    optionsCount: getRelationValue(question.options)?.count ?? 0,
    correctOptionLabel: question.correct_option_label,
    tags: question.tags ?? [],
    createdAt: question.created_at,
    updatedAt: question.updated_at,
    publishedAt: question.published_at,
    archivedAt: question.archived_at,
    stats: null,
  }
}

/** Structural view of a PostgREST filter builder — just the methods the shared filters need. */
interface QuestionFilterBuilder {
  eq(column: string, value: unknown): QuestionFilterBuilder
  ilike(column: string, pattern: string): QuestionFilterBuilder
  contains(column: string, value: unknown): QuestionFilterBuilder
}

/** Applies the shared admin bank filters to any questions query builder. */
function applyAdminQuestionFilters<T>(query: T, filters: AdminQuestionFilters): T {
  let next = query as unknown as QuestionFilterBuilder
  if (filters.examType) {
    next = next.eq('exam_type', filters.examType)
  }
  if (filters.subjectId) {
    next = next.eq('subject_id', filters.subjectId)
  }
  if (filters.topicId) {
    next = next.eq('topic_id', filters.topicId)
  }
  if (filters.questionTypeId) {
    next = next.eq('question_type_id', filters.questionTypeId)
  }
  if (filters.tag) {
    next = next.contains('tags', [filters.tag])
  }
  if (filters.difficulty) {
    next = next.eq('difficulty', Number(filters.difficulty))
  }
  if (filters.status) {
    next = next.eq('status', filters.status)
  }
  if (filters.query) {
    next = next.ilike('question_text', `%${filters.query.trim()}%`)
  }
  return next as unknown as T
}

function parseSort(value: string | undefined): AdminQuestionSort {
  return (ADMIN_QUESTION_SORTS as readonly string[]).includes(value ?? '')
    ? (value as AdminQuestionSort)
    : 'updated_desc'
}

function parsePageSize(value: string | undefined): number {
  const parsed = Number(value)
  return (ADMIN_QUESTION_PAGE_SIZES as readonly number[]).includes(parsed)
    ? parsed
    : DEFAULT_ADMIN_QUESTION_PAGE_SIZE
}

const STAT_SORTS = ['accuracy_asc', 'accuracy_desc', 'attempts_desc'] as const satisfies readonly AdminQuestionSort[]
type StatSort = (typeof STAT_SORTS)[number]

const COLUMN_SORTS: Record<Exclude<AdminQuestionSort, StatSort>, { column: string; ascending: boolean }> = {
  updated_desc: { column: 'updated_at', ascending: false },
  updated_asc: { column: 'updated_at', ascending: true },
  created_desc: { column: 'created_at', ascending: false },
  created_asc: { column: 'created_at', ascending: true },
  difficulty_desc: { column: 'difficulty', ascending: false },
  difficulty_asc: { column: 'difficulty', ascending: true },
}

/**
 * One page of the admin question bank. Filtering, counting and pagination all
 * happen in Postgres; only the visible page's rows are fetched. Stat-based
 * sorts (accuracy / attempts) can't be expressed as a column order, so they
 * sort a lightweight id list against the whole-bank attempt summary first,
 * then hydrate just the requested slice.
 */
export async function getAdminQuestionsPage(filters: AdminQuestionFilters = {}): Promise<AdminQuestionsPage> {
  const supabase = await createClient()
  const sort = parseSort(filters.sort)
  const pageSize = parsePageSize(filters.pageSize)
  const requestedPage = Math.max(1, Number(filters.page) || 1)

  if ((STAT_SORTS as readonly AdminQuestionSort[]).includes(sort)) {
    return getAdminQuestionsPageByStats(filters, sort, requestedPage, pageSize)
  }

  // Count first so an out-of-range page (e.g. filters narrowed while on page 9)
  // clamps to the last page instead of erroring with an unsatisfiable range.
  const countQuery = applyAdminQuestionFilters(
    supabase.from('questions').select('id', { count: 'exact', head: true }),
    filters
  )
  const { count, error: countError } = await countQuery

  if (countError) {
    throw new Error('Unable to count admin questions.')
  }

  const totalCount = count ?? 0
  const pageCount = Math.max(1, Math.ceil(totalCount / pageSize))
  const page = Math.min(requestedPage, pageCount)

  if (totalCount === 0) {
    return { items: [], totalCount: 0, page: 1, pageSize, pageCount: 1 }
  }

  const order = COLUMN_SORTS[sort as keyof typeof COLUMN_SORTS]
  const from = (page - 1) * pageSize
  const dataQuery = applyAdminQuestionFilters(
    supabase.from('questions').select(ADMIN_QUESTION_LIST_SELECT),
    filters
  )
    .order(order.column, { ascending: order.ascending })
    .order('id', { ascending: true })
    .range(from, from + pageSize - 1)

  const { data, error } = await dataQuery

  if (error) {
    throw new Error('Unable to load admin questions.')
  }

  return {
    items: ((data ?? []) as unknown as AdminQuestionRawRow[]).map(mapAdminQuestionRow),
    totalCount,
    page,
    pageSize,
    pageCount,
  }
}

/** Stat-sorted page: order matching ids by the whole-bank attempt summary, then hydrate the slice. */
async function getAdminQuestionsPageByStats(
  filters: AdminQuestionFilters,
  sort: AdminQuestionSort,
  requestedPage: number,
  pageSize: number
): Promise<AdminQuestionsPage> {
  const supabase = await createClient()

  const idQuery = applyAdminQuestionFilters(supabase.from('questions').select('id'), filters)
  const [{ data: idRows, error: idError }, statsSummary] = await Promise.all([
    idQuery,
    getAdminQuestionStats(null),
  ])

  if (idError) {
    throw new Error('Unable to load admin questions.')
  }

  const ids = ((idRows ?? []) as Array<{ id: string }>).map((row) => row.id)
  const sorted = [...ids].sort((a, b) => {
    const statsA = statsSummary.get(a)
    const statsB = statsSummary.get(b)
    if (sort === 'attempts_desc') {
      return (statsB?.totalAttempts ?? 0) - (statsA?.totalAttempts ?? 0)
    }
    // Accuracy sorts: questions without attempts always sink to the bottom.
    const accuracyA = statsA?.accuracy ?? null
    const accuracyB = statsB?.accuracy ?? null
    if (accuracyA === null && accuracyB === null) return 0
    if (accuracyA === null) return 1
    if (accuracyB === null) return -1
    return sort === 'accuracy_asc' ? accuracyA - accuracyB : accuracyB - accuracyA
  })

  const totalCount = sorted.length
  const pageCount = Math.max(1, Math.ceil(totalCount / pageSize))
  const page = Math.min(requestedPage, pageCount)

  if (totalCount === 0) {
    return { items: [], totalCount: 0, page: 1, pageSize, pageCount: 1 }
  }

  const pageIds = sorted.slice((page - 1) * pageSize, page * pageSize)
  const { data, error } = await supabase
    .from('questions')
    .select(ADMIN_QUESTION_LIST_SELECT)
    .in('id', pageIds)

  if (error) {
    throw new Error('Unable to load admin questions.')
  }

  const byId = new Map(
    ((data ?? []) as unknown as AdminQuestionRawRow[]).map((row) => [row.id, mapAdminQuestionRow(row)])
  )
  const items = pageIds
    .map((id) => byId.get(id))
    .filter((item): item is AdminQuestionListItem => Boolean(item))

  return { items, totalCount, page, pageSize, pageCount }
}

export interface QuestionStatusCounts {
  total: number
  published: number
  draft: number
  archived: number
}

/** Whole-bank counts by status for the Question Bank metric chips (ignores filters). */
export async function getQuestionStatusCounts(): Promise<QuestionStatusCounts> {
  const supabase = await createClient()

  const countByStatus = (status?: string) => {
    let query = supabase.from('questions').select('id', { count: 'exact', head: true })
    if (status) {
      query = query.eq('status', status)
    }
    return query
  }

  const [total, published, draft, archived] = await Promise.all([
    countByStatus(),
    countByStatus('published'),
    countByStatus('draft'),
    countByStatus('archived'),
  ])

  if (total.error || published.error || draft.error || archived.error) {
    throw new Error('Unable to load question status counts.')
  }

  return {
    total: total.count ?? 0,
    published: published.count ?? 0,
    draft: draft.count ?? 0,
    archived: archived.count ?? 0,
  }
}

export async function getExistingQuestionTexts(): Promise<string[]> {
  const supabase = await createClient()
  const { data, error } = await supabase.from('questions').select('question_text')

  if (error) {
    throw new Error('Unable to load existing questions for duplicate detection.')
  }

  return ((data ?? []) as Array<{ question_text: string }>).map((row) => row.question_text)
}

/** Distinct tags already used across the bank — powers the "new tag" import warning. */
export async function getExistingTags(): Promise<string[]> {
  const supabase = await createClient()
  const { data, error } = await supabase.from('questions').select('tags')

  if (error) {
    throw new Error('Unable to load existing tags.')
  }

  const tags = new Set<string>()
  for (const row of (data ?? []) as Array<{ tags: string[] | null }>) {
    for (const tag of row.tags ?? []) {
      if (tag.trim()) {
        tags.add(tag.trim())
      }
    }
  }
  return [...tags]
}

export async function validateQuestionTaxonomy(
  subjectId: string,
  topicId: string,
  questionTypeId: string | null
): Promise<Record<string, string>> {
  const supabase = await createClient()
  const errors: Record<string, string> = {}

  const { data: topic } = await supabase
    .from('topics')
    .select('id, subject_id')
    .eq('id', topicId)
    .maybeSingle()

  if (!topic) {
    errors.topicId = 'Choose a valid topic.'
  } else if (topic.subject_id !== subjectId) {
    errors.topicId = 'Topic must belong to the selected subject.'
  }

  if (questionTypeId) {
    const { data: questionType } = await supabase
      .from('question_types')
      .select('id, subject_id')
      .eq('id', questionTypeId)
      .maybeSingle()

    if (!questionType || questionType.subject_id !== subjectId) {
      errors.questionTypeId = 'Question type must belong to the selected subject.'
    }
  }

  return errors
}

export async function getQuestionById(id: string): Promise<QuestionDetail | null> {
  const supabase = await createClient()
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

/**
 * Reveals the answer, short explanation and worked solution for a single PUBLISHED question.
 * Used when a student submits an answer so the correct answer is never shipped to the client
 * alongside the question itself. Returns null for non-published or missing questions.
 */
export async function getPublishedQuestionFeedback(questionId: string): Promise<{
  correctOptionLabel: QuestionOptionLabel
  shortExplanation: string | null
  workedSolution: string
} | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('questions')
    .select('correct_option_label, short_explanation, worked_solution')
    .eq('id', questionId)
    .eq('status', 'published')
    .maybeSingle()

  if (error) {
    throw new Error('Unable to check this answer.')
  }

  if (!data) {
    return null
  }

  return {
    correctOptionLabel: data.correct_option_label as QuestionOptionLabel,
    shortExplanation: data.short_explanation,
    workedSolution: data.worked_solution,
  }
}

/**
 * Fetches a single PUBLISHED question in the student-facing practice shape (no correct answer),
 * used to retry a tracked mistake on the revision page.
 */
export async function getPublishedPracticeQuestion(questionId: string): Promise<PracticeQuestionItem | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
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
    .eq('id', questionId)
    .eq('status', 'published')
    .maybeSingle()

  if (error) {
    throw new Error('Unable to load the question for revision.')
  }

  if (!data) {
    return null
  }

  const question = data as unknown as Pick<
    QuestionRecord,
    'id' | 'subject_id' | 'topic_id' | 'question_type_id' | 'exam_type' | 'difficulty' | 'question_text' | 'passage_text'
  > & {
    subject: { name: string }[] | { name: string } | null
    topic: { name: string }[] | { name: string } | null
    question_type: { name: string }[] | { name: string } | null
  }

  const optionsMap = await getQuestionOptionsMap([questionId])

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
    questionText: question.question_text,
    passageText: question.passage_text,
    options: optionsMap.get(questionId) ?? [],
  }
}

/**
 * Fetches the candidate pool (up to 100 published questions, without options)
 * matching the practice filters. Callers pick from the pool (mode logic lives in
 * the practice action) and hydrate the selection via hydratePracticeQuestions.
 */
export async function getPracticeQuestionPool(
  filters: Omit<PracticeQuestionFilters, 'limit'>
): Promise<Array<Omit<PracticeQuestionItem, 'options'>>> {
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

  return questions.map((question) => ({
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
  }))
}

/** Attaches answer options to a picked set of pool questions. */
export async function hydratePracticeQuestions(
  questions: Array<Omit<PracticeQuestionItem, 'options'>>
): Promise<PracticeQuestionItem[]> {
  const optionsMap = await getQuestionOptionsMap(questions.map((question) => question.id))

  return questions.map((question) => ({
    ...question,
    options: optionsMap.get(question.id) ?? [],
  }))
}

export async function getPracticeQuestions(filters: PracticeQuestionFilters): Promise<PracticeQuestionItem[]> {
  const pool = await getPracticeQuestionPool(filters)
  return hydratePracticeQuestions(shuffleArray(pool).slice(0, filters.limit))
}

export { shuffleArray }
