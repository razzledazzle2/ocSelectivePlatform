import type { FullExportQuestion } from '@/lib/questions/export-full-csv'
import { getAdminQuestionStats } from '@/lib/questions/stats'
import { mapStimulusDetail } from '@/lib/stimuli/queries'
import { createClient } from '@/lib/supabase/server'
import {
  ADMIN_QUESTION_PAGE_SIZES,
  ADMIN_QUESTION_SORTS,
  DEFAULT_ADMIN_QUESTION_PAGE_SIZE,
  type AdminQuestionFilters,
  type AdminQuestionListItem,
  type AdminQuestionsPage,
  type AdminQuestionSort,
  type AssetRecord,
  type QuestionAssetLink,
  type QuestionDetail,
  type QuestionOptionRecord,
  type QuestionRecord,
  type QuestionTypeRecord,
  type QuestionVariantRecord,
  type StimulusRecord,
  type StudentAssetRef,
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

/** Maps a full assets row to the lightweight shape shipped to students. */
export function toStudentAssetRef(asset: AssetRecord): StudentAssetRef {
  return {
    id: asset.id,
    assetType: asset.asset_type,
    externalRef: asset.external_ref,
    storagePath: asset.storage_path,
    externalUrl: asset.external_url,
    altText: asset.alt_text,
    status: asset.status,
  }
}

type OptionRawRow = QuestionOptionRecord & {
  question_id: string
  asset: AssetRecord | AssetRecord[] | null
}

const QUESTION_OPTION_SELECT =
  'id, question_id, label, option_text, sort_order, asset_id, explanation, created_at, asset:assets(*)'

async function getQuestionOptionsMap(questionIds: string[]): Promise<Map<string, QuestionOptionRecord[]>> {
  if (!questionIds.length) {
    return new Map()
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('question_options')
    .select(QUESTION_OPTION_SELECT)
    .in('question_id', questionIds)
    .order('sort_order', { ascending: true })

  if (error) {
    throw new Error('Unable to load question options.')
  }

  const optionsMap = new Map<string, QuestionOptionRecord[]>()

  for (const row of (data ?? []) as unknown as OptionRawRow[]) {
    const { asset, ...option } = row
    const hydratedAsset = getRelationValue(asset)
    const existing = optionsMap.get(row.question_id) ?? []
    existing.push({ ...option, asset: hydratedAsset ? toStudentAssetRef(hydratedAsset) : null })
    optionsMap.set(row.question_id, existing)
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

/** All question variants (essential question type sub-variants), active first. */
export async function getQuestionVariants(): Promise<QuestionVariantRecord[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('question_variants')
    .select('id, question_type_id, name, slug, description, sort_order, is_active')
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true })

  if (error) {
    throw new Error('Unable to load question variants.')
  }

  return (data ?? []) as QuestionVariantRecord[]
}

type AdminQuestionRawRow = Pick<
  QuestionRecord,
  | 'id'
  | 'question_text'
  | 'exam_type'
  | 'difficulty'
  | 'status'
  | 'answer_format'
  | 'stimulus_id'
  | 'correct_option_label'
  | 'created_at'
  | 'updated_at'
  | 'published_at'
  | 'archived_at'
  | 'deleted_at'
> & {
  tags: string[] | null
  subject: { name: string }[] | { name: string } | null
  topic: { name: string }[] | { name: string } | null
  question_type: { name: string }[] | { name: string } | null
  options: { count: number }[] | { count: number } | null
  question_assets:
    | Array<{ asset: { status: string } | { status: string }[] | null }>
    | null
}

const ADMIN_QUESTION_LIST_SELECT = `
  id,
  question_text,
  exam_type,
  difficulty,
  status,
  answer_format,
  stimulus_id,
  correct_option_label,
  tags,
  created_at,
  updated_at,
  published_at,
  archived_at,
  deleted_at,
  subject:subjects(name),
  topic:topics(name),
  question_type:question_types(name),
  options:question_options(count),
  question_assets(asset:assets(status))
`

/** Asset statuses that mean "not ready to publish" (placeholder or rejected). */
const NOT_READY_ASSET_STATUSES = new Set(['pending', 'rejected'])

/** Rolls a question's linked asset statuses into a single readiness state. */
function deriveAssetState(
  links: AdminQuestionRawRow['question_assets']
): AdminQuestionListItem['assetState'] {
  const rows = links ?? []
  if (rows.length === 0) {
    return 'none'
  }
  const statuses = rows.map((link) => {
    const asset = Array.isArray(link.asset) ? link.asset[0] : link.asset
    return asset?.status ?? null
  })
  return statuses.some((status) => !status || NOT_READY_ASSET_STATUSES.has(status)) ? 'pending' : 'ready'
}

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
    answerFormat: question.answer_format,
    hasStimulus: question.stimulus_id !== null,
    hasAssets: (question.question_assets ?? []).length > 0,
    assetState: deriveAssetState(question.question_assets),
    optionsCount: getRelationValue(question.options)?.count ?? 0,
    correctOptionLabel: question.correct_option_label,
    tags: question.tags ?? [],
    createdAt: question.created_at,
    updatedAt: question.updated_at,
    publishedAt: question.published_at,
    archivedAt: question.archived_at,
    deletedAt: question.deleted_at,
    stats: null,
  }
}

/** Structural view of a PostgREST filter builder — just the methods the shared filters need. */
interface QuestionFilterBuilder {
  eq(column: string, value: unknown): QuestionFilterBuilder
  ilike(column: string, pattern: string): QuestionFilterBuilder
  contains(column: string, value: unknown): QuestionFilterBuilder
  in(column: string, values: readonly unknown[]): QuestionFilterBuilder
  is(column: string, value: unknown): QuestionFilterBuilder
  not(column: string, operator: string, value: unknown): QuestionFilterBuilder
}

/**
 * Synthetic status value for the admin bank "trash" view. It is NOT a
 * questions.status value (soft delete is tracked by deleted_at); selecting it
 * flips the shared filter from "hide trash" to "show only trash".
 */
export const DELETED_STATUS_FILTER = 'deleted'

/** A resolved set of question ids to include or exclude (used by the asset filter). */
export interface AssetIdConstraint {
  mode: 'in' | 'not_in'
  ids: string[]
}

// A UUID that will never be a real question id, so an empty "include" set yields
// zero rows rather than a PostgREST error on an empty IN list.
const IMPOSSIBLE_ID = '00000000-0000-0000-0000-000000000000'

/**
 * Resolves the asset-readiness filter to a question-id constraint, so filtering
 * and pagination stay in Postgres (the constraint is applied to both the count
 * and the data query). Returns null when no asset filter is active.
 */
export async function resolveAssetStateConstraint(
  filters: AdminQuestionFilters
): Promise<AssetIdConstraint | null> {
  if (!filters.assetState) {
    return null
  }
  const supabase = await createClient()
  const { data, error } = await supabase.from('question_assets').select('question_id, asset:assets(status)')
  if (error) {
    throw new Error('Unable to resolve the asset filter.')
  }

  const statusesByQuestion = new Map<string, string[]>()
  for (const row of (data ?? []) as Array<{
    question_id: string
    asset: { status: string } | { status: string }[] | null
  }>) {
    const asset = Array.isArray(row.asset) ? row.asset[0] : row.asset
    const list = statusesByQuestion.get(row.question_id) ?? []
    list.push(asset?.status ?? 'pending')
    statusesByQuestion.set(row.question_id, list)
  }
  const withAssets = [...statusesByQuestion.keys()]
  const hasStatus = (predicate: (status: string) => boolean): string[] =>
    withAssets.filter((id) => (statusesByQuestion.get(id) ?? []).some(predicate))

  switch (filters.assetState) {
    case 'has':
      return { mode: 'in', ids: withAssets }
    case 'missing':
      return { mode: 'not_in', ids: withAssets }
    case 'pending':
      return { mode: 'in', ids: hasStatus((status) => NOT_READY_ASSET_STATUSES.has(status)) }
    case 'approved':
      return { mode: 'in', ids: hasStatus((status) => status === 'approved') }
    default:
      return null
  }
}

/** Applies the shared admin bank filters to any questions query builder. */
export function applyAdminQuestionFilters<T>(
  query: T,
  filters: AdminQuestionFilters,
  assetIds?: AssetIdConstraint | null
): T {
  let next = query as unknown as QuestionFilterBuilder
  // Soft delete: the "Deleted (Trash)" filter shows ONLY trashed questions;
  // every other view (including no status filter) excludes them entirely.
  if (filters.status === DELETED_STATUS_FILTER) {
    next = next.not('deleted_at', 'is', null)
  } else {
    next = next.is('deleted_at', null)
  }
  if (assetIds) {
    if (assetIds.mode === 'in') {
      next = next.in('id', assetIds.ids.length ? assetIds.ids : [IMPOSSIBLE_ID])
    } else if (assetIds.ids.length) {
      next = next.not('id', 'in', `(${assetIds.ids.join(',')})`)
    }
  }
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
  if (filters.domainCode) {
    next = next.eq('domain_code', filters.domainCode)
  }
  if (filters.subtopicCode) {
    next = next.eq('subtopic_code', filters.subtopicCode)
  }
  if (filters.skillCode) {
    next = next.eq('skill_code', filters.skillCode)
  }
  if (filters.questionFamily) {
    next = next.eq('question_family', filters.questionFamily)
  }
  if (filters.stimulusFormat) {
    next = next.eq('stimulus_format', filters.stimulusFormat)
  }
  if (filters.patternKey) {
    next = next.eq('pattern_key', filters.patternKey)
  }
  if (filters.tag) {
    next = next.contains('tags', [filters.tag])
  }
  if (filters.difficulty) {
    next = next.eq('difficulty', Number(filters.difficulty))
  }
  // 'deleted' is a synthetic trash filter handled above, not a real status.
  if (filters.status && filters.status !== DELETED_STATUS_FILTER) {
    next = next.eq('status', filters.status)
  }
  if (filters.validationStatus) {
    next = next.eq('validation_status', filters.validationStatus)
  }
  if (filters.answerFormat) {
    next = next.eq('answer_format', filters.answerFormat)
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

  const assetIds = await resolveAssetStateConstraint(filters)

  if ((STAT_SORTS as readonly AdminQuestionSort[]).includes(sort)) {
    return getAdminQuestionsPageByStats(filters, sort, requestedPage, pageSize, assetIds)
  }

  // Count first so an out-of-range page (e.g. filters narrowed while on page 9)
  // clamps to the last page instead of erroring with an unsatisfiable range.
  const countQuery = applyAdminQuestionFilters(
    supabase.from('questions').select('id', { count: 'exact', head: true }),
    filters,
    assetIds
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
    filters,
    assetIds
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
  pageSize: number,
  assetIds: AssetIdConstraint | null
): Promise<AdminQuestionsPage> {
  const supabase = await createClient()

  const idQuery = applyAdminQuestionFilters(supabase.from('questions').select('id'), filters, assetIds)
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
  reviewed: number
  archived: number
  /** Soft-deleted (trash) questions; excluded from every other count. */
  deleted: number
}

/**
 * Whole-bank counts by status for the Question Bank metric chips (ignores
 * filters). Every status count excludes trashed questions so the totals stay
 * honest; `deleted` counts the trash on its own.
 */
export async function getQuestionStatusCounts(): Promise<QuestionStatusCounts> {
  const supabase = await createClient()

  const countByStatus = (status?: string) => {
    let query = supabase
      .from('questions')
      .select('id', { count: 'exact', head: true })
      .is('deleted_at', null)
    if (status) {
      query = query.eq('status', status)
    }
    return query
  }

  const [total, published, draft, reviewed, archived, deleted] = await Promise.all([
    countByStatus(),
    countByStatus('published'),
    countByStatus('draft'),
    countByStatus('reviewed'),
    countByStatus('archived'),
    supabase
      .from('questions')
      .select('id', { count: 'exact', head: true })
      .not('deleted_at', 'is', null),
  ])

  if (total.error || published.error || draft.error || reviewed.error || archived.error || deleted.error) {
    throw new Error('Unable to load question status counts.')
  }

  return {
    total: total.count ?? 0,
    published: published.count ?? 0,
    draft: draft.count ?? 0,
    reviewed: reviewed.count ?? 0,
    archived: archived.count ?? 0,
    deleted: deleted.count ?? 0,
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

/** External ids already used in the bank — powers import duplicate detection. */
export async function getExistingQuestionExternalIds(): Promise<string[]> {
  const supabase = await createClient()
  const { data, error } = await supabase.from('questions').select('external_id').not('external_id', 'is', null)

  if (error) {
    throw new Error('Unable to load existing question external ids.')
  }

  return ((data ?? []) as Array<{ external_id: string | null }>)
    .map((row) => row.external_id)
    .filter((externalId): externalId is string => Boolean(externalId))
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
      question_type:question_types(*),
      stimulus:stimuli(*, stimulus_assets(id, sort_order, asset:assets(*))),
      question_assets(id, role, sort_order, asset:assets(*))
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
    stimulus:
      | Array<StimulusRecord & { stimulus_assets: never }>
      | (StimulusRecord & { stimulus_assets: never })
      | null
    question_assets:
      | Array<{ id: string; role: 'question' | 'solution'; sort_order: number; asset: AssetRecord | AssetRecord[] | null }>
      | null
  }
  const subject = getRelationValue(question.subject)
  const topic = getRelationValue(question.topic)
  const rawStimulus = getRelationValue(question.stimulus)

  const assets: QuestionAssetLink[] = (question.question_assets ?? [])
    .map((link) => ({
      id: link.id,
      role: link.role,
      sort_order: link.sort_order,
      asset: getRelationValue(link.asset),
    }))
    .filter((link): link is QuestionAssetLink => Boolean(link.asset))
    .sort((left, right) => left.sort_order - right.sort_order)

  const { stimulus: _stimulus, question_assets: _questionAssets, ...record } = question

  return {
    ...(record as unknown as QuestionRecord),
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
    stimulus: rawStimulus ? mapStimulusDetail(rawStimulus as unknown as Parameters<typeof mapStimulusDetail>[0]) : null,
    assets,
  }
}

// -- Full round-trip export ----------------------------------------------------

type ExportAssetRef = Pick<AssetRecord, 'external_ref' | 'storage_path' | 'external_url'>

/**
 * Question/solution asset with the metadata columns needed for a lossless export.
 * `spec` is the structured diagram spec (assets.spec, migration 20260708001849):
 * exporting it lets a re-import regenerate the exact SVG in-app via
 * resolveAssetGeneration — no committed spec files or AI needed.
 */
type ExportAssetMeta = ExportAssetRef & Pick<AssetRecord, 'alt_text' | 'generation_prompt' | 'status' | 'spec' | 'asset_type'>

function toExportAssetRef(asset: ExportAssetRef | ExportAssetRef[] | null): string | null {
  const resolved = getRelationValue(asset)
  if (!resolved) {
    return null
  }
  return resolved.external_ref ?? resolved.storage_path ?? resolved.external_url ?? null
}

type FullExportRawRow = Pick<
  QuestionRecord,
  | 'id'
  | 'external_id'
  | 'exam_type'
  | 'year_level'
  | 'difficulty'
  | 'marks'
  | 'time_limit_seconds'
  | 'answer_format'
  | 'question_text'
  | 'passage_text'
  | 'correct_option_label'
  | 'worked_solution'
  | 'short_explanation'
  | 'stimulus_id'
  | 'skill_tags'
  | 'concept_tags'
  | 'tags'
  | 'rubric'
  | 'presentation'
  | 'source_info'
  | 'status'
  | 'domain_code'
  | 'subtopic_code'
  | 'skill_code'
  | 'pattern_key'
  | 'question_family'
  | 'stimulus_format'
  | 'stimulus_genre'
  | 'asset_render_method'
  | 'writing_form'
  | 'writing_purpose'
  | 'writing_prompt_stimulus'
> & {
  subject: { name: string }[] | { name: string } | null
  topic: { name: string; strand: string | null }[] | { name: string; strand: string | null } | null
  question_type: { name: string }[] | { name: string } | null
  variant: { name: string }[] | { name: string } | null
  options:
    | Array<{
        label: string
        option_text: string
        sort_order: number
        explanation: string | null
        asset: ExportAssetRef | ExportAssetRef[] | null
      }>
    | null
  question_assets:
    | Array<{ role: 'question' | 'solution'; sort_order: number; asset: ExportAssetMeta | ExportAssetMeta[] | null }>
    | null
  stimulus:
    | Array<{
        id: string
        external_ref: string | null
        title: string
        stimulus_type: string
        body_markdown: string | null
        stimulus_assets: Array<{ sort_order: number; asset: ExportAssetRef | ExportAssetRef[] | null }> | null
      }>
    | {
        id: string
        external_ref: string | null
        title: string
        stimulus_type: string
        body_markdown: string | null
        stimulus_assets: Array<{ sort_order: number; asset: ExportAssetRef | ExportAssetRef[] | null }> | null
      }
    | null
}

const FULL_EXPORT_SELECT = `
  id,
  external_id,
  exam_type,
  year_level,
  difficulty,
  marks,
  time_limit_seconds,
  answer_format,
  question_text,
  passage_text,
  correct_option_label,
  worked_solution,
  short_explanation,
  stimulus_id,
  skill_tags,
  concept_tags,
  tags,
  rubric,
  presentation,
  source_info,
  status,
  domain_code,
  subtopic_code,
  skill_code,
  pattern_key,
  question_family,
  stimulus_format,
  stimulus_genre,
  asset_render_method,
  writing_form,
  writing_purpose,
  writing_prompt_stimulus,
  subject:subjects(name),
  topic:topics(name, strand),
  question_type:question_types(name),
  variant:question_variants(name),
  options:question_options(label, option_text, sort_order, explanation, asset:assets(external_ref, storage_path, external_url)),
  question_assets(role, sort_order, asset:assets(external_ref, storage_path, external_url, alt_text, generation_prompt, status, spec, asset_type)),
  stimulus:stimuli(id, external_ref, title, stimulus_type, body_markdown, stimulus_assets(sort_order, asset:assets(external_ref, storage_path, external_url)))
`

function mapFullExportRow(row: FullExportRawRow): FullExportQuestion {
  const stimulus = getRelationValue(row.stimulus)
  const assetLinks = [...(row.question_assets ?? [])].sort((left, right) => left.sort_order - right.sort_order)

  const refsForRole = (role: 'question' | 'solution'): string[] =>
    assetLinks
      .filter((link) => link.role === role)
      .map((link) => toExportAssetRef(link.asset))
      .filter((ref): ref is string => Boolean(ref))

  // Asset metadata (prompt/alt/spec/status) round-trips at the row level, taken
  // from the first question-role asset — the common one-asset-per-row case.
  const primaryAsset = getRelationValue(
    assetLinks.find((link) => link.role === 'question')?.asset ?? null
  )

  return {
    externalId: row.external_id,
    subjectName: getRelationValue(row.subject)?.name ?? '',
    strand: getRelationValue(row.topic)?.strand ?? null,
    topicName: getRelationValue(row.topic)?.name ?? '',
    questionTypeName: getRelationValue(row.question_type)?.name ?? null,
    variantName: getRelationValue(row.variant)?.name ?? null,
    examType: row.exam_type,
    yearLevel: row.year_level,
    difficulty: row.difficulty,
    marks: row.marks,
    timeLimitSeconds: row.time_limit_seconds,
    answerFormat: row.answer_format,
    questionText: row.question_text,
    passageText: row.passage_text,
    options: [...(row.options ?? [])]
      .sort((left, right) => left.sort_order - right.sort_order)
      .map((option) => ({
        label: option.label,
        text: option.option_text,
        explanation: option.explanation,
        assetRef: toExportAssetRef(option.asset),
      })),
    correctOptionLabel: row.correct_option_label,
    workedSolution: row.worked_solution,
    shortExplanation: row.short_explanation,
    stimulus: stimulus
      ? {
          id: stimulus.id,
          externalRef: stimulus.external_ref,
          title: stimulus.title,
          stimulusType: stimulus.stimulus_type,
          bodyMarkdown: stimulus.body_markdown,
          assetRefs: [...(stimulus.stimulus_assets ?? [])]
            .sort((left, right) => left.sort_order - right.sort_order)
            .map((link) => toExportAssetRef(link.asset))
            .filter((ref): ref is string => Boolean(ref)),
        }
      : null,
    questionAssetRefs: refsForRole('question'),
    solutionAssetRefs: refsForRole('solution'),
    assetGenerationPrompt: primaryAsset?.generation_prompt ?? null,
    assetAltText: primaryAsset?.alt_text ?? null,
    // spec is DB-sourced so a re-import can regenerate the SVG deterministically.
    assetSpec: primaryAsset?.spec ?? null,
    assetStatus: primaryAsset?.status ?? null,
    assetType: primaryAsset?.asset_type ?? null,
    assetRequired: primaryAsset ? true : null,
    presentation: row.presentation ?? {},
    rubric: row.rubric,
    skillTags: row.skill_tags ?? [],
    conceptTags: row.concept_tags ?? [],
    tags: row.tags ?? [],
    sourceInfo: row.source_info ?? {},
    status: row.status,
    domainCode: row.domain_code ?? null,
    subtopicCode: row.subtopic_code ?? null,
    skillCode: row.skill_code ?? null,
    patternKey: row.pattern_key ?? null,
    questionFamily: row.question_family ?? null,
    stimulusFormat: row.stimulus_format ?? null,
    stimulusGenre: row.stimulus_genre ?? null,
    assetRenderMethod: row.asset_render_method ?? null,
    writingForm: row.writing_form ?? null,
    writingPurpose: row.writing_purpose ?? null,
    writingPromptStimulus: row.writing_prompt_stimulus ?? null,
  }
}

const EXPORT_BATCH_SIZE = 1000

/**
 * Every question matching the admin filters (no page limit; batched), hydrated
 * with options, stimulus and asset refs for the round-trip CSV export. Pass
 * `idConstraint` to scope the export to a specific set of question ids (e.g. the
 * rows the admin checked) instead of the whole filtered bank.
 */
export async function getQuestionsForFullExport(
  filters: AdminQuestionFilters = {},
  idConstraint: AssetIdConstraint | null = null
): Promise<FullExportQuestion[]> {
  const supabase = await createClient()
  const rows: FullExportQuestion[] = []

  for (let from = 0; ; from += EXPORT_BATCH_SIZE) {
    const query = applyAdminQuestionFilters(
      supabase.from('questions').select(FULL_EXPORT_SELECT),
      filters,
      idConstraint
    )
      .order('created_at', { ascending: true })
      .order('id', { ascending: true })
      .range(from, from + EXPORT_BATCH_SIZE - 1)

    const { data, error } = await query

    if (error) {
      throw new Error('Unable to load questions for export.')
    }

    const batch = (data ?? []) as unknown as FullExportRawRow[]
    rows.push(...batch.map(mapFullExportRow))

    if (batch.length < EXPORT_BATCH_SIZE) {
      break
    }
  }

  return rows
}

/** Full export snapshot plus the raw foreign keys needed to write an update without re-resolving names. */
export interface ExistingQuestionSnapshot extends FullExportQuestion {
  questionId: string
  subjectId: string
  topicId: string
  questionTypeId: string | null
  variantId: string | null
  /** The FK column (not the embedded stimulus relation's own id). */
  stimulusIdRaw: string | null
}

type ExistingSnapshotRawRow = FullExportRawRow &
  Pick<QuestionRecord, 'subject_id' | 'topic_id' | 'question_type_id' | 'variant_id'>

/**
 * Full-content snapshots of existing questions matching the given external_ids, keyed by
 * external_id — powers the update-mode import's field-level diff preview. Reuses the same
 * select/mapper as the full export so "existing value" is never a truncated/different shape
 * from "incoming value". Matches ANY row regardless of soft-delete (external_id stays unique
 * in the DB even for trashed questions, so it must still be treated as "taken").
 */
export async function getQuestionSnapshotsByExternalIds(
  externalIds: string[]
): Promise<Map<string, ExistingQuestionSnapshot>> {
  const snapshots = new Map<string, ExistingQuestionSnapshot>()
  const ids = [...new Set(externalIds.map((id) => id.trim()).filter(Boolean))]
  if (ids.length === 0) {
    return snapshots
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('questions')
    .select(`${FULL_EXPORT_SELECT}, subject_id, topic_id, question_type_id, variant_id`)
    .in('external_id', ids)

  if (error) {
    throw new Error('Unable to load existing questions for update comparison.')
  }

  for (const raw of (data ?? []) as unknown as ExistingSnapshotRawRow[]) {
    const mapped = mapFullExportRow(raw)
    if (!mapped.externalId) {
      continue
    }
    snapshots.set(mapped.externalId, {
      ...mapped,
      questionId: raw.id,
      subjectId: raw.subject_id,
      topicId: raw.topic_id,
      questionTypeId: raw.question_type_id,
      variantId: raw.variant_id,
      stimulusIdRaw: raw.stimulus_id,
    })
  }

  return snapshots
}
