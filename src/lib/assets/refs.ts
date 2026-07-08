// Single source of truth for how an asset reference string is interpreted.
//
// Used by both the import pipeline (to decide what to store in the assets row)
// and the client renderer (to decide how to resolve a ref to something an
// <img> can display). Keep this file client-safe: no server-only imports.
//
// Reference schemes
// -----------------
//   asset://pending/<name>              → a placeholder; the file does not exist
//                                         yet. Renders as a "coming soon" card.
//   asset://question-assets/<path>      → a deterministically generated asset
//                                         committed under public/question-assets/.
//                                         Served at /question-assets/<path>.
//   https?://<url>                      → an externally hosted asset.
//   <anything-else>                     → an object key in the private
//                                         `question-media` Supabase Storage bucket.

/** Ref prefix for placeholders that have no file yet. */
export const PENDING_REF_PREFIX = 'asset://pending/'

/** Ref prefix for generated assets served from the Next.js public folder. */
export const PUBLIC_ASSET_REF_PREFIX = 'asset://question-assets/'

/** Public URL prefix the generated refs resolve to (mirrors scripts/generate-assets.mjs). */
export const PUBLIC_ASSET_URL_PREFIX = '/question-assets/'

export type ResolvedAssetRef =
  | { kind: 'pending' }
  | { kind: 'public'; url: string }
  | { kind: 'external'; url: string }
  | { kind: 'storage'; storagePath: string }

/** Classifies a raw asset reference string into how it should be resolved/stored. */
export function resolveAssetRef(ref: string): ResolvedAssetRef {
  const trimmed = ref.trim()

  if (trimmed.startsWith(PENDING_REF_PREFIX)) {
    return { kind: 'pending' }
  }
  if (trimmed.startsWith(PUBLIC_ASSET_REF_PREFIX)) {
    return { kind: 'public', url: PUBLIC_ASSET_URL_PREFIX + trimmed.slice(PUBLIC_ASSET_REF_PREFIX.length) }
  }
  if (/^https?:\/\//i.test(trimmed)) {
    return { kind: 'external', url: trimmed }
  }
  // Already an absolute public path (e.g. re-imported manifest storage_path).
  if (trimmed.startsWith(PUBLIC_ASSET_URL_PREFIX)) {
    return { kind: 'public', url: trimmed }
  }
  return { kind: 'storage', storagePath: trimmed }
}

/** True when a ref points at a placeholder that has no backing file yet. */
export function isPendingRef(ref: string): boolean {
  return resolveAssetRef(ref).kind === 'pending'
}
