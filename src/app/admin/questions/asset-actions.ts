'use server'

import { revalidatePath } from 'next/cache'

import {
  generateAssetsForQuestion,
  generateMissingAssets,
  regenerateAsset,
  type AssetGenerationResult,
} from '@/lib/assets/generate-missing'
import { requireProfile } from '@/lib/auth/require-profile'
import { ADMIN_PORTAL_ROLES, type ActionResult } from '@/lib/types'

function revalidateAssetPaths(questionId?: string) {
  revalidatePath('/admin/questions')
  revalidatePath('/admin/dashboard')
  revalidatePath('/student/practice')
  if (questionId) {
    revalidatePath(`/admin/questions/${questionId}/preview`)
    revalidatePath(`/admin/questions/${questionId}/edit`)
  }
}

/** Builds a human-readable summary line from a generation result. */
function summariseMessage(result: AssetGenerationResult, scope: string): string {
  if (result.generatedCount === 0 && result.pendingCount === 0 && result.failedCount === 0) {
    return `No pending assets ${scope}.`
  }
  const parts: string[] = [
    `Generated ${result.generatedCount} asset${result.generatedCount === 1 ? '' : 's'}`,
  ]
  if (result.pendingCount > 0) {
    parts.push(`${result.pendingCount} still pending (no generator/spec)`)
  }
  if (result.failedCount > 0) {
    parts.push(`${result.failedCount} failed`)
  }
  return `${parts.join(', ')}.`
}

/** Bank-wide: generate every pending deterministic asset that can be generated. */
export async function generateMissingAssetsAction(): Promise<ActionResult<AssetGenerationResult>> {
  const profile = await requireProfile({ allowedRoles: [...ADMIN_PORTAL_ROLES] })

  try {
    const result = await generateMissingAssets(profile.id)
    if (result.generatedCount > 0) {
      revalidateAssetPaths()
    }
    return { success: true, data: result, message: summariseMessage(result, 'in the bank') }
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unable to generate missing assets right now.',
    }
  }
}

/** Generate the pending assets belonging to one question. */
export async function generateQuestionAssetsAction(
  questionId: string
): Promise<ActionResult<AssetGenerationResult>> {
  const profile = await requireProfile({ allowedRoles: [...ADMIN_PORTAL_ROLES] })

  try {
    const result = await generateAssetsForQuestion(questionId, profile.id)
    if (result.generatedCount > 0) {
      revalidateAssetPaths(questionId)
    }
    return { success: true, data: result, message: summariseMessage(result, 'for this question') }
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unable to generate this question’s assets right now.',
    }
  }
}

/** Force-regenerate a single (generated/pending/rejected) asset from its spec. */
export async function regenerateAssetAction(
  assetId: string,
  questionId?: string
): Promise<ActionResult> {
  const profile = await requireProfile({ allowedRoles: [...ADMIN_PORTAL_ROLES] })

  try {
    const detail = await regenerateAsset(assetId, profile.id)
    if (detail.outcome === 'generated') {
      revalidateAssetPaths(questionId)
      return { success: true, message: 'Asset regenerated.' }
    }
    return {
      success: false,
      message: detail.reason ?? 'The asset could not be regenerated.',
    }
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unable to regenerate the asset right now.',
    }
  }
}
