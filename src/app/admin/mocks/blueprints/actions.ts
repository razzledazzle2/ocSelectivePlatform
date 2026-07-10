'use server'

import { revalidatePath } from 'next/cache'

import { requireProfile } from '@/lib/auth/require-profile'
import {
  createMockBlueprint,
  deleteMockBlueprint,
  setBlueprintStatus,
  updateMockBlueprint,
} from '@/lib/mock-blueprints/mutations'
import { normalizeBlueprintSpec } from '@/lib/mock-blueprints/spec'
import { BLUEPRINT_STATUSES, type BlueprintStatus, type MockBlueprintInput } from '@/lib/mock-blueprints/types'
import { ADMIN_PORTAL_ROLES, EXAM_TYPES, type ActionResult, type ExamType } from '@/lib/types'

function revalidateBlueprintPaths(id?: string) {
  revalidatePath('/admin/mocks/blueprints')
  if (id) revalidatePath(`/admin/mocks/blueprints/${id}`)
}

/** Parse the blueprint form; the spec arrives as a JSON string the editor builds. */
function parseBlueprint(formData: FormData): { input?: MockBlueprintInput; error?: ActionResult } {
  const title = String(formData.get('title') ?? '').trim()
  const description = String(formData.get('description') ?? '').trim() || null
  const examTypeRaw = String(formData.get('examType') ?? '').trim()
  const subjectCode = String(formData.get('subjectCode') ?? '').trim() || null
  const statusRaw = String(formData.get('status') ?? 'draft')
  const specRaw = String(formData.get('spec') ?? '{}')

  const fieldErrors: Record<string, string> = {}
  if (!title) fieldErrors.title = 'Enter a blueprint title.'
  const examType: ExamType | null = (EXAM_TYPES as readonly string[]).includes(examTypeRaw)
    ? (examTypeRaw as ExamType)
    : null
  const status: BlueprintStatus = (BLUEPRINT_STATUSES as readonly string[]).includes(statusRaw)
    ? (statusRaw as BlueprintStatus)
    : 'draft'

  let parsedSpec: unknown = {}
  try {
    parsedSpec = JSON.parse(specRaw)
  } catch {
    fieldErrors.spec = 'The blueprint rules are not valid JSON.'
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { error: { success: false, message: 'Please fix the highlighted fields.', fieldErrors } }
  }

  return {
    input: {
      title,
      description,
      examType,
      subjectCode,
      status,
      spec: normalizeBlueprintSpec(parsedSpec),
    },
  }
}

export async function createBlueprintAction(formData: FormData): Promise<ActionResult<{ redirectTo: string }>> {
  const profile = await requireProfile({ allowedRoles: [...ADMIN_PORTAL_ROLES] })
  const { input, error } = parseBlueprint(formData)
  if (error || !input) return error!
  try {
    const id = await createMockBlueprint(input, profile.id)
    revalidateBlueprintPaths(id)
    return { success: true, message: 'Blueprint created.', data: { redirectTo: `/admin/mocks/blueprints/${id}` } }
  } catch (caught) {
    return { success: false, message: caught instanceof Error ? caught.message : 'Unable to create the blueprint.' }
  }
}

export async function updateBlueprintAction(id: string, formData: FormData): Promise<ActionResult> {
  const profile = await requireProfile({ allowedRoles: [...ADMIN_PORTAL_ROLES] })
  const { input, error } = parseBlueprint(formData)
  if (error || !input) return error!
  try {
    await updateMockBlueprint(id, input, profile.id)
    revalidateBlueprintPaths(id)
    return { success: true, message: 'Blueprint saved.' }
  } catch (caught) {
    return { success: false, message: caught instanceof Error ? caught.message : 'Unable to save the blueprint.' }
  }
}

export async function setBlueprintStatusAction(id: string, status: BlueprintStatus): Promise<ActionResult> {
  const profile = await requireProfile({ allowedRoles: [...ADMIN_PORTAL_ROLES] })
  if (!(BLUEPRINT_STATUSES as readonly string[]).includes(status)) {
    return { success: false, message: 'Unknown status.' }
  }
  try {
    await setBlueprintStatus(id, status, profile.id)
    revalidateBlueprintPaths(id)
    return { success: true, message: `Blueprint ${status}.` }
  } catch (caught) {
    return { success: false, message: caught instanceof Error ? caught.message : 'Unable to change the status.' }
  }
}

export async function deleteBlueprintAction(id: string): Promise<ActionResult<{ redirectTo: string }>> {
  await requireProfile({ allowedRoles: [...ADMIN_PORTAL_ROLES] })
  try {
    await deleteMockBlueprint(id)
    revalidateBlueprintPaths()
    return { success: true, message: 'Blueprint deleted.', data: { redirectTo: '/admin/mocks/blueprints' } }
  } catch (caught) {
    return { success: false, message: caught instanceof Error ? caught.message : 'Unable to delete the blueprint.' }
  }
}
