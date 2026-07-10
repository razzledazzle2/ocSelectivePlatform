import { createClient } from '@/lib/supabase/server'

export {
  ALLOWED_ASSET_EXTENSIONS,
  MAX_RASTER_BYTES,
  MAX_SVG_BYTES,
  validateAssetFile,
  type AssetFileInput,
  type AssetValidationResult,
} from '@/lib/assets/validate-file'

/**
 * Uploads a validated asset buffer to the existing `question-media` Storage bucket (staff-only
 * insert RLS already in place — see migration 20260706081946). Import uploads are namespaced
 * under `imports/<importBatchId>/...`: a fresh batch id per run means cross-run filename
 * collisions are structurally impossible, so this never needs (and never uses) upsert.
 */
export async function uploadQuestionAsset(
  importBatchId: string,
  relativePath: string,
  buffer: Buffer,
  mimeType: string
): Promise<string> {
  const supabase = await createClient()
  const storagePath = `imports/${importBatchId}/${relativePath}`

  const { error } = await supabase.storage.from('question-media').upload(storagePath, buffer, {
    contentType: mimeType,
    upsert: false,
  })

  if (error) {
    throw new Error(`Unable to upload "${relativePath}" to storage: ${error.message}`)
  }

  return storagePath
}
