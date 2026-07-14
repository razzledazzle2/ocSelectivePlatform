import { checksumPrefix } from '@/lib/assets/image-metadata'
import { slugify } from '@/lib/questions/slug'
import { createClient } from '@/lib/supabase/server'

export {
  ALLOWED_ASSET_EXTENSIONS,
  MAX_RASTER_BYTES,
  MAX_SVG_BYTES,
  validateAssetFile,
  type AssetFileInput,
  type AssetValidationResult,
} from '@/lib/assets/validate-file'

/** Private Supabase Storage bucket that holds question-bank media (see migration 20260706081946). */
export const QUESTION_MEDIA_BUCKET = 'question-media'

/** Prefix (inside the bucket) for import-committed assets, kept distinct from any legacy `imports/`. */
const COMMITTED_PREFIX = 'question-assets'

const EXTENSION_BY_MIME: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
}

export interface DeterministicPathInput {
  /** Question external_id (or stimulus ref) the asset belongs to — namespaces the object. */
  externalId: string
  /** stimulus | question | solution | option-a … — the slot the asset fills. */
  role: string
  /** 0-based index within a multi-asset role. */
  index: number
  mimeType: string
  checksum: string
}

/**
 * Builds the stable, content-addressed storage path an asset commits to:
 *   question-assets/{externalId}/{role}-{index}-{checksumPrefix}.{ext}
 * Deterministic on (externalId, role, index, content), so re-importing the same package resolves
 * to the same path — the upload upserts and the assets row dedupes on external_ref, making repeat
 * imports idempotent. A content change yields a new checksum → a new path (the old object is left
 * untouched rather than silently overwritten).
 */
export function buildAssetStoragePath(input: DeterministicPathInput): string {
  const extension = EXTENSION_BY_MIME[input.mimeType] ?? 'bin'
  const idSegment = slugify(input.externalId || 'question')
  const roleSegment = slugify(input.role || 'asset')
  return `${COMMITTED_PREFIX}/${idSegment}/${roleSegment}-${input.index}-${checksumPrefix(input.checksum)}.${extension}`
}

/**
 * Uploads a validated asset buffer to the private `question-media` bucket at a deterministic path
 * (staff-only insert RLS already in place). `upsert: true` because the path is content-addressed:
 * the only way the same path is written twice is with byte-identical content, so an overwrite is
 * a no-op in effect and makes repeated imports safe.
 */
export async function uploadQuestionAsset(
  storagePath: string,
  buffer: Buffer,
  mimeType: string
): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase.storage.from(QUESTION_MEDIA_BUCKET).upload(storagePath, buffer, {
    contentType: mimeType,
    upsert: true,
  })

  if (error) {
    throw new Error(`Unable to upload "${storagePath}" to storage: ${error.message}`)
  }
}

/**
 * Best-effort removal of staged storage objects during import compensation/rollback. Never throws —
 * returns the paths it failed to delete so the caller can surface a clear "cleanup incomplete"
 * notice instead of leaving the failure silent.
 */
export async function removeUploadedAssets(paths: string[]): Promise<{ failedPaths: string[] }> {
  if (paths.length === 0) {
    return { failedPaths: [] }
  }
  try {
    const supabase = await createClient()
    const { error } = await supabase.storage.from(QUESTION_MEDIA_BUCKET).remove(paths)
    return { failedPaths: error ? paths : [] }
  } catch {
    return { failedPaths: paths }
  }
}
