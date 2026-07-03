'use server'

import { revalidatePath } from 'next/cache'

import { requireProfile } from '@/lib/auth/require-profile'
import {
  createQuestionType,
  createSubject,
  createTopic,
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
    return { success: true, message: isActive ? 'Enabled.' : 'Disabled.' }
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : 'Unable to update the item.' }
  }
}
