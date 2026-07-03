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
  name: string
): Promise<string> {
  const cleanName = name.trim() || 'General'
  const slug = slugify(cleanName)

  const { data: existing } = await supabase
    .from('topics')
    .select('id')
    .eq('subject_id', subjectId)
    .eq('slug', slug)
    .maybeSingle()

  if (existing?.id) {
    return existing.id
  }

  const { data: inserted, error } = await supabase
    .from('topics')
    .insert({ subject_id: subjectId, name: cleanName, slug })
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
