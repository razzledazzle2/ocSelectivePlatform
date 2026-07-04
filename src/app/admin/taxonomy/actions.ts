'use server'

import { revalidatePath } from 'next/cache'

import { requireProfile } from '@/lib/auth/require-profile'
import {
  createQuestionType,
  createSubject,
  createTopic,
  mergeTopics,
  renameTagEverywhere,
  renameTaxonomyItem,
  setTaxonomyActive,
} from '@/lib/questions/taxonomy-mutations'
import { ADMIN_PORTAL_ROLES, type ActionResult } from '@/lib/types'

function revalidateTaxonomy() {
  revalidatePath('/admin/taxonomy')
  revalidatePath('/admin/questions')
  revalidatePath('/student/practice')
}

export async function createSubjectAction(formData: FormData): Promise<ActionResult> {
  await requireProfile({ allowedRoles: [...ADMIN_PORTAL_ROLES] })
  const name = String(formData.get('name') ?? '').trim()
  const description = String(formData.get('description') ?? '').trim() || null

  if (!name) {
    return { success: false, message: 'Enter a subject name.' }
  }

  try {
    await createSubject(name, description)
    revalidateTaxonomy()
    return { success: true, message: `Subject "${name}" created.` }
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : 'Unable to create the subject.' }
  }
}

export async function createTopicAction(formData: FormData): Promise<ActionResult> {
  await requireProfile({ allowedRoles: [...ADMIN_PORTAL_ROLES] })
  const subjectId = String(formData.get('subjectId') ?? '').trim()
  const name = String(formData.get('name') ?? '').trim()

  if (!subjectId) {
    return { success: false, message: 'Choose a subject for the topic.' }
  }
  if (!name) {
    return { success: false, message: 'Enter a topic name.' }
  }

  try {
    await createTopic(subjectId, name)
    revalidateTaxonomy()
    return { success: true, message: `Topic "${name}" created.` }
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : 'Unable to create the topic.' }
  }
}

export async function createQuestionTypeAction(formData: FormData): Promise<ActionResult> {
  await requireProfile({ allowedRoles: [...ADMIN_PORTAL_ROLES] })
  const subjectId = String(formData.get('subjectId') ?? '').trim()
  const topicId = String(formData.get('topicId') ?? '').trim() || null
  const name = String(formData.get('name') ?? '').trim()

  if (!subjectId) {
    return { success: false, message: 'Choose a subject for the question type.' }
  }
  if (!name) {
    return { success: false, message: 'Enter a question type name.' }
  }

  try {
    await createQuestionType(subjectId, topicId, name)
    revalidateTaxonomy()
    return { success: true, message: `Question type "${name}" created.` }
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unable to create the question type.',
    }
  }
}

export async function toggleTaxonomyActiveAction(
  table: 'subjects' | 'topics' | 'question_types',
  id: string,
  isActive: boolean
): Promise<ActionResult> {
  await requireProfile({ allowedRoles: [...ADMIN_PORTAL_ROLES] })

  try {
    await setTaxonomyActive(table, id, isActive)
    revalidateTaxonomy()
    return { success: true, message: isActive ? 'Restored.' : 'Archived.' }
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : 'Unable to update the item.' }
  }
}

export async function renameTaxonomyAction(
  table: 'subjects' | 'topics' | 'question_types',
  id: string,
  name: string
): Promise<ActionResult> {
  await requireProfile({ allowedRoles: [...ADMIN_PORTAL_ROLES] })

  try {
    await renameTaxonomyItem(table, id, name)
    revalidateTaxonomy()
    return { success: true, message: `Renamed to "${name.trim()}".` }
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : 'Unable to rename the item.' }
  }
}

export async function mergeTopicsAction(sourceTopicId: string, targetTopicId: string): Promise<ActionResult> {
  await requireProfile({ allowedRoles: [...ADMIN_PORTAL_ROLES] })

  try {
    await mergeTopics(sourceTopicId, targetTopicId)
    revalidateTaxonomy()
    return { success: true, message: 'Topics merged. The source topic is archived.' }
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : 'Unable to merge the topics.' }
  }
}

export async function renameTagAction(oldTag: string, newTag: string): Promise<ActionResult> {
  await requireProfile({ allowedRoles: [...ADMIN_PORTAL_ROLES] })

  try {
    const affected = await renameTagEverywhere(oldTag, newTag)
    revalidateTaxonomy()
    return {
      success: true,
      message: `Tag updated on ${affected} question${affected === 1 ? '' : 's'}.`,
    }
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : 'Unable to rename the tag.' }
  }
}
