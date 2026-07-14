import { slugify } from '@/lib/questions/slug'
import { createClient } from '@/lib/supabase/server'
import type { QuestionTypeRecord, TopicRecord } from '@/lib/types'

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>

/**
 * Resolve-or-create a topic under a subject, keyed by (subject_id, slug) which
 * is the table's unique constraint. Safe to call repeatedly within one import:
 * if the slug already exists it returns the existing row rather than erroring.
 */
export async function ensureTopic(
  supabase: SupabaseServerClient,
  subjectId: string,
  name: string,
  strand?: string | null
): Promise<string> {
  const cleanName = name.trim() || 'General'
  const slug = slugify(cleanName)

  const { data: existing } = await supabase
    .from('topics')
    .select('id')
    .eq('subject_id', subjectId)
    .eq('slug', slug)
    .maybeSingle()

  // Existing topics are reused as-is; strand only applies to newly created ones.
  if (existing?.id) {
    return existing.id
  }

  const { data: inserted, error } = await supabase
    .from('topics')
    .insert({ subject_id: subjectId, name: cleanName, slug, strand: strand?.trim() || null })
    .select('id')
    .single()

  if (error || !inserted) {
    // A concurrent insert may have won the race — re-read before giving up.
    const { data: raced } = await supabase
      .from('topics')
      .select('id')
      .eq('subject_id', subjectId)
      .eq('slug', slug)
      .maybeSingle()
    if (raced?.id) {
      return raced.id
    }
    throw new Error(`Unable to create topic "${cleanName}".`)
  }

  return inserted.id
}

/**
 * Resolve-or-create a question type under a subject (and optional topic).
 * Keyed by (subject_id, slug) per the unique constraint; topic_id is stored so
 * types can be topic-specific where the taxonomy supports it.
 */
export async function ensureQuestionType(
  supabase: SupabaseServerClient,
  subjectId: string,
  topicId: string | null,
  name: string
): Promise<string> {
  const cleanName = name.trim()
  const slug = slugify(cleanName)

  const { data: existing } = await supabase
    .from('question_types')
    .select('id')
    .eq('subject_id', subjectId)
    .eq('slug', slug)
    .maybeSingle()

  if (existing?.id) {
    return existing.id
  }

  const { data: inserted, error } = await supabase
    .from('question_types')
    .insert({ subject_id: subjectId, topic_id: topicId, name: cleanName, slug })
    .select('id')
    .single()

  if (error || !inserted) {
    const { data: raced } = await supabase
      .from('question_types')
      .select('id')
      .eq('subject_id', subjectId)
      .eq('slug', slug)
      .maybeSingle()
    if (raced?.id) {
      return raced.id
    }
    throw new Error(`Unable to create question type "${cleanName}".`)
  }

  return inserted.id
}

/**
 * Resolve-or-create a question variant under an essential question type.
 * Keyed by (question_type_id, slug) per the unique constraint.
 */
export async function ensureQuestionVariant(
  supabase: SupabaseServerClient,
  questionTypeId: string,
  name: string
): Promise<string> {
  const cleanName = name.trim()
  const slug = slugify(cleanName)

  const { data: existing } = await supabase
    .from('question_variants')
    .select('id')
    .eq('question_type_id', questionTypeId)
    .eq('slug', slug)
    .maybeSingle()

  if (existing?.id) {
    return existing.id
  }

  const { data: inserted, error } = await supabase
    .from('question_variants')
    .insert({ question_type_id: questionTypeId, name: cleanName, slug })
    .select('id')
    .single()

  if (error || !inserted) {
    const { data: raced } = await supabase
      .from('question_variants')
      .select('id')
      .eq('question_type_id', questionTypeId)
      .eq('slug', slug)
      .maybeSingle()
    if (raced?.id) {
      return raced.id
    }
    throw new Error(`Unable to create question variant "${cleanName}".`)
  }

  return inserted.id
}

/** Creates a top-level subject (admin taxonomy page). */
export async function createSubject(name: string, description: string | null): Promise<string> {
  const supabase = await createClient()
  const cleanName = name.trim()
  const { data, error } = await supabase
    .from('subjects')
    .insert({ name: cleanName, slug: slugify(cleanName), description })
    .select('id')
    .single()

  if (error || !data) {
    throw new Error(`Unable to create subject "${cleanName}". A subject with this name may already exist.`)
  }

  return data.id
}

/** Creates a topic under a subject (admin taxonomy page). */
export async function createTopic(subjectId: string, name: string): Promise<TopicRecord> {
  const supabase = await createClient()
  const cleanName = name.trim()
  const { data, error } = await supabase
    .from('topics')
    .insert({ subject_id: subjectId, name: cleanName, slug: slugify(cleanName) })
    .select('id, subject_id, name, slug, description, sort_order, is_active, created_at, updated_at')
    .single()

  if (error || !data) {
    throw new Error(`Unable to create topic "${cleanName}". A topic with this name may already exist here.`)
  }

  return data as TopicRecord
}

/** Creates a question type under a subject (and optional topic) (admin taxonomy page). */
export async function createQuestionType(
  subjectId: string,
  topicId: string | null,
  name: string
): Promise<QuestionTypeRecord> {
  const supabase = await createClient()
  const cleanName = name.trim()
  const { data, error } = await supabase
    .from('question_types')
    .insert({ subject_id: subjectId, topic_id: topicId, name: cleanName, slug: slugify(cleanName) })
    .select('id, subject_id, topic_id, name, slug, description, sort_order, is_active, created_at, updated_at')
    .single()

  if (error || !data) {
    throw new Error(`Unable to create question type "${cleanName}". One with this name may already exist.`)
  }

  return data as QuestionTypeRecord
}

type TaxonomyTable = 'subjects' | 'topics' | 'question_types'

/** Toggles is_active for a taxonomy row (soft enable/disable from the admin page). */
export async function setTaxonomyActive(
  table: TaxonomyTable,
  id: string,
  isActive: boolean
): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase.from(table).update({ is_active: isActive }).eq('id', id)

  if (error) {
    throw new Error('Unable to update the taxonomy item.')
  }
}

/**
 * Renames a taxonomy row and re-derives its slug. Existing questions keep
 * pointing at the same row (they reference by id), so a rename instantly
 * flows through the whole bank.
 */
export async function renameTaxonomyItem(table: TaxonomyTable, id: string, name: string): Promise<void> {
  const supabase = await createClient()
  const cleanName = name.trim()

  if (!cleanName) {
    throw new Error('Enter a name.')
  }

  const { error } = await supabase
    .from(table)
    .update({ name: cleanName, slug: slugify(cleanName) })
    .eq('id', id)

  if (error) {
    throw new Error(`Unable to rename to "${cleanName}". An item with this name may already exist.`)
  }
}

/**
 * Merges one topic into another (same subject): every question and question
 * type on the source topic is repointed at the target, then the source topic
 * is deactivated (kept for history, hidden from pickers). Nothing is deleted.
 */
export async function mergeTopics(sourceTopicId: string, targetTopicId: string): Promise<void> {
  if (sourceTopicId === targetTopicId) {
    throw new Error('Choose two different topics to merge.')
  }

  const supabase = await createClient()
  const { data: rows, error: readError } = await supabase
    .from('topics')
    .select('id, subject_id, name')
    .in('id', [sourceTopicId, targetTopicId])

  if (readError || (rows ?? []).length !== 2) {
    throw new Error('Unable to load the topics to merge.')
  }

  const source = rows!.find((row) => row.id === sourceTopicId)!
  const target = rows!.find((row) => row.id === targetTopicId)!

  if (source.subject_id !== target.subject_id) {
    throw new Error('Topics can only be merged within the same subject.')
  }

  const { error: questionsError } = await supabase
    .from('questions')
    .update({ topic_id: targetTopicId })
    .eq('topic_id', sourceTopicId)

  if (questionsError) {
    throw new Error('Unable to move questions to the target topic.')
  }

  const { error: typesError } = await supabase
    .from('question_types')
    .update({ topic_id: targetTopicId })
    .eq('topic_id', sourceTopicId)

  if (typesError) {
    throw new Error('Questions were moved, but question types could not be repointed.')
  }

  const { error: deactivateError } = await supabase
    .from('topics')
    .update({ is_active: false })
    .eq('id', sourceTopicId)

  if (deactivateError) {
    throw new Error(`Questions were moved, but "${source.name}" could not be archived.`)
  }
}

/**
 * Renames a tag across every question (merging when the new tag already
 * exists on a question). Prefers the admin_rename_tag SQL function; while that
 * migration is pending it falls back to per-question updates in app code.
 * Returns the number of questions touched.
 */
export async function renameTagEverywhere(oldTag: string, newTag: string): Promise<number> {
  const cleanOld = oldTag.trim()
  const cleanNew = newTag.trim()

  if (!cleanOld || !cleanNew) {
    throw new Error('Both the current and new tag are required.')
  }
  if (cleanOld === cleanNew) {
    throw new Error('The new tag matches the current tag.')
  }

  const supabase = await createClient()
  const { data: rpcCount, error: rpcError } = await supabase.rpc('admin_rename_tag', {
    p_old_tag: cleanOld,
    p_new_tag: cleanNew,
  })

  if (!rpcError) {
    return Number(rpcCount ?? 0)
  }

  // Fallback while the admin_rename_tag migration is pending.
  const { data: rows, error: readError } = await supabase
    .from('questions')
    .select('id, tags')
    .contains('tags', [cleanOld])

  if (readError) {
    throw new Error('Unable to load questions using this tag.')
  }

  for (const row of (rows ?? []) as Array<{ id: string; tags: string[] }>) {
    const nextTags = [...new Set(row.tags.map((tag) => (tag === cleanOld ? cleanNew : tag)))]
    const { error: updateError } = await supabase.from('questions').update({ tags: nextTags }).eq('id', row.id)
    if (updateError) {
      throw new Error('Some questions could not be updated — re-run the rename to finish.')
    }
  }

  return rows?.length ?? 0
}
