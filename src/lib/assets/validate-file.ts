import DOMPurify from 'dompurify'
import { JSDOM } from 'jsdom'

import type { AssetType } from '@/lib/types'

/**
 * Pure asset-file validation/sanitisation — no `@/` runtime imports beyond a type-only one (so
 * this module is unit-testable directly with `node --test`, unlike upload.ts which needs the
 * Supabase server client). dompurify/jsdom are ordinary node_modules dependencies.
 */

/** Extensions accepted for import-uploaded assets. Anything else is rejected outright. */
export const ALLOWED_ASSET_EXTENSIONS = ['svg', 'png', 'jpg', 'jpeg', 'webp'] as const

export const MAX_SVG_BYTES = 300 * 1024 // 300KB — these are diagrams/illustrations, never large.
export const MAX_RASTER_BYTES = 5 * 1024 * 1024 // 5MB

export interface AssetFileInput {
  filename: string
  size: number
  buffer: Buffer
}

export interface AssetValidationResult {
  ok: boolean
  reason?: string
  /** For SVGs, the sanitised buffer to actually store (script/handlers/foreignObject stripped). */
  sanitizedBuffer?: Buffer
  mimeType: string
  assetType: AssetType
}

const MIME_BY_EXTENSION: Record<string, string> = {
  svg: 'image/svg+xml',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
}

function extensionOf(filename: string): string {
  const match = filename.toLowerCase().match(/\.([a-z0-9]+)$/)
  return match?.[1] ?? ''
}

/** Sniffs the actual file type from its magic bytes / leading text — never trust the extension alone. */
export function sniffFileType(buffer: Buffer): 'svg' | 'png' | 'jpeg' | 'webp' | null {
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return 'png'
  }
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'jpeg'
  }
  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return 'webp'
  }
  // SVG is text — sniff the first non-whitespace/BOM/XML-prolog/comment chunk for an <svg> tag.
  const head = buffer.subarray(0, Math.min(buffer.length, 4096)).toString('utf8')
  if (/^\s*(<\?xml[^>]*\?>\s*)?(<!--[\s\S]*?-->\s*)*(<!doctype[^>]*>\s*)?<svg[\s>]/i.test(head)) {
    return 'svg'
  }
  return null
}

/** Strips `<script>`, event-handler attributes, `javascript:`/`data:` URIs and `<foreignObject>` from an SVG. */
export function sanitizeSvg(svgText: string): string | null {
  const { window } = new JSDOM('')
  const purify = DOMPurify(window as unknown as Parameters<typeof DOMPurify>[0])
  const clean = purify.sanitize(svgText, {
    USE_PROFILES: { svg: true, svgFilters: false },
    FORBID_TAGS: ['script', 'foreignObject', 'style'],
    FORBID_ATTR: ['onload', 'onerror', 'onclick', 'onmouseover'],
  })
  return /<svg[\s>]/i.test(clean) ? clean : null
}

/**
 * Validates an uploaded asset file before it's ever written to storage: extension allowlist,
 * magic-byte sniff (rejects a mismatched claimed-vs-actual type — the classic disguise attack),
 * size caps, and — for SVGs — sanitisation to remove anything that could execute script.
 * Never throws; every failure comes back as a typed `{ ok: false, reason }`.
 */
export function validateAssetFile(file: AssetFileInput): AssetValidationResult {
  const extension = extensionOf(file.filename)
  const fallback: AssetValidationResult = { ok: false, mimeType: 'application/octet-stream', assetType: 'image' }

  if (!extension || !(ALLOWED_ASSET_EXTENSIONS as readonly string[]).includes(extension)) {
    return { ...fallback, reason: `Unsupported file type "${extension || file.filename}". Allowed: ${ALLOWED_ASSET_EXTENSIONS.join(', ')}.` }
  }

  const sniffed = sniffFileType(file.buffer)
  const expectedSniff = extension === 'jpg' ? 'jpeg' : extension
  if (!sniffed || sniffed !== expectedSniff) {
    return { ...fallback, reason: `File content does not match its ".${extension}" extension.` }
  }

  const maxBytes = sniffed === 'svg' ? MAX_SVG_BYTES : MAX_RASTER_BYTES
  if (file.size > maxBytes) {
    return {
      ...fallback,
      reason: `File is too large (${Math.ceil(file.size / 1024)}KB, max ${Math.ceil(maxBytes / 1024)}KB).`,
    }
  }

  if (sniffed === 'svg') {
    const sanitized = sanitizeSvg(file.buffer.toString('utf8'))
    if (!sanitized) {
      return { ...fallback, reason: 'SVG failed sanitisation (no safe <svg> content survived).' }
    }
    return {
      ok: true,
      mimeType: MIME_BY_EXTENSION.svg,
      assetType: 'svg',
      sanitizedBuffer: Buffer.from(sanitized, 'utf8'),
    }
  }

  return { ok: true, mimeType: MIME_BY_EXTENSION[extension], assetType: 'image' }
}
