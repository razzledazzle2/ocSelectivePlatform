import { createHash } from 'node:crypto'
import path from 'node:path'

import JSZip from 'jszip'

import type { UploadedAssetFile } from '@/lib/import/types'

/** Lowercase hex SHA-256 — kept local (node:crypto, not a `@/` import) so the parser stays unit-testable. */
function sha256Hex(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex')
}

/** One asset entry declared in an optional package manifest.json. */
export interface ManifestAssetEntry {
  external_id?: string
  role?: string
  option_key?: string
  path: string
  mime_type?: string
  width?: number
  height?: number
  size_bytes?: number
  checksum?: string
  alt_text?: string
}

/** Optional manifest.json shipped at the root of a question package. All fields are advisory. */
export interface ImportManifest {
  package_version?: string
  generated_at?: string
  question_count?: number
  asset_count?: number
  csv_filename?: string
  package_checksum?: string
  assets?: ManifestAssetEntry[]
}

export interface ParsedImportPackage {
  csvText: string
  assetFiles: Map<string, UploadedAssetFile>
  /** Parsed manifest.json when the package shipped one (else null). */
  manifest: ImportManifest | null
  /** Parse-time issues and (non-blocking) manifest-consistency warnings. */
  errors: string[]
}

export interface ParseImportPackageInput {
  /** Plain CSV/paste text — used as-is when neither zip is present, or paired with extraZipBuffer. */
  csvText?: string
  /** A single zip containing a root .csv file plus an assets/ directory. */
  zipBuffer?: Buffer
  /** A zip containing ONLY asset files, paired with csvText from a separate upload. */
  extraZipBuffer?: Buffer
}

const ASSETS_DIR_PREFIX = 'assets/'

/**
 * Normalises a zip entry name and rejects anything unsafe: absolute paths, backslashes
 * (rejected outright rather than treated as separators), and `..` traversal. Returns null
 * for directory entries or unsafe paths — callers must skip/report those, never extract them.
 */
function safeRelativePath(rawName: string): string | null {
  if (!rawName || rawName.endsWith('/')) {
    return null
  }
  if (rawName.includes('\\') || rawName.startsWith('/')) {
    return null
  }
  const normalized = path.posix.normalize(rawName)
  if (normalized.startsWith('..') || normalized.startsWith('/')) {
    return null
  }
  return normalized
}

/**
 * Extracts every file entry from a loaded zip into an in-memory map, never touching disk (so
 * classic zip-slip is structurally impossible — there is no filesystem write to redirect).
 * `stripPrefix` (case-insensitive) is removed from each path and non-matching entries are
 * skipped, letting a single zip mix a root CSV with an assets/ subtree.
 */
async function extractAssetFiles(
  zip: JSZip,
  stripPrefix: string | null
): Promise<{ files: Map<string, UploadedAssetFile>; errors: string[] }> {
  const files = new Map<string, UploadedAssetFile>()
  const errors: string[] = []
  const seenKeys = new Set<string>()

  for (const [rawName, entry] of Object.entries(zip.files)) {
    if (entry.dir) {
      continue
    }
    const safe = safeRelativePath(rawName)
    if (!safe) {
      errors.push(`Skipped an unsafe path in the zip: "${rawName}".`)
      continue
    }

    let relativePath = safe
    if (stripPrefix) {
      if (!relativePath.toLowerCase().startsWith(stripPrefix)) {
        continue
      }
      relativePath = relativePath.slice(stripPrefix.length)
      if (!relativePath) {
        continue
      }
    }

    const key = relativePath.toLowerCase()
    if (seenKeys.has(key)) {
      errors.push(`Duplicate asset filename in the zip: "${relativePath}".`)
      continue
    }
    seenKeys.add(key)

    const buffer = await entry.async('nodebuffer')
    files.set(key, {
      relativePath,
      filename: path.posix.basename(relativePath),
      size: buffer.length,
      buffer,
    })
  }

  return { files, errors }
}

/**
 * Reads and validates an optional root manifest.json. The manifest is purely advisory — a package
 * with only questions.csv + assets is fully valid — so every inconsistency is returned as a warning
 * (never an error). Checks: declared files that are absent from the zip, checksum mismatches, and a
 * declared asset_count that disagrees with the extracted file count.
 */
function validateManifest(
  manifest: ImportManifest,
  assetFiles: Map<string, UploadedAssetFile>
): string[] {
  const warnings: string[] = []
  const entries = Array.isArray(manifest.assets) ? manifest.assets : []

  for (const entry of entries) {
    if (!entry?.path) {
      continue
    }
    const file = findUploadedAssetFile(assetFiles, entry.path)
    if (!file) {
      warnings.push(`manifest.json lists "${entry.path}" but the file is not in the package.`)
      continue
    }
    if (entry.checksum && sha256Hex(file.buffer) !== entry.checksum.toLowerCase()) {
      warnings.push(`manifest.json checksum for "${entry.path}" does not match the packaged file.`)
    }
  }

  if (typeof manifest.asset_count === 'number' && manifest.asset_count !== assetFiles.size) {
    warnings.push(
      `manifest.json declares ${manifest.asset_count} asset(s) but the package contains ${assetFiles.size}.`
    )
  }

  return warnings
}

/** Reads a root manifest.json entry if present; returns null (with a warning) on malformed JSON. */
async function readManifest(
  zip: JSZip,
  warnings: string[]
): Promise<ImportManifest | null> {
  const manifestName = Object.keys(zip.files)
    .filter((name) => !zip.files[name].dir)
    .find((name) => {
      const safe = safeRelativePath(name)
      return Boolean(safe && !safe.includes('/') && safe.toLowerCase() === 'manifest.json')
    })
  if (!manifestName) {
    return null
  }
  try {
    const parsed: unknown = JSON.parse(await zip.files[manifestName].async('string'))
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      warnings.push('manifest.json is not a JSON object; ignoring it.')
      return null
    }
    return parsed as ImportManifest
  } catch {
    warnings.push('manifest.json could not be parsed as JSON; ignoring it.')
    return null
  }
}

/**
 * Parses the three supported import shapes: CSV text alone; CSV text + a separate assets-only
 * zip; or one zip containing a root `.csv` file plus an `assets/` directory (and an optional
 * manifest.json). Never writes to disk — everything stays as in-memory buffers keyed by a
 * sanitised relative path.
 */
export async function parseImportPackage(input: ParseImportPackageInput): Promise<ParsedImportPackage> {
  if (input.zipBuffer) {
    const zip = await JSZip.loadAsync(input.zipBuffer)
    const csvEntryName = Object.keys(zip.files)
      .filter((name) => !zip.files[name].dir)
      .find((name) => {
        const safe = safeRelativePath(name)
        return Boolean(safe && !safe.includes('/') && safe.toLowerCase().endsWith('.csv'))
      })

    if (!csvEntryName) {
      return {
        csvText: '',
        assetFiles: new Map(),
        manifest: null,
        errors: ['The zip must contain a .csv file at its root (e.g. questions.csv).'],
      }
    }

    const csvText = await zip.files[csvEntryName].async('string')
    const { files, errors } = await extractAssetFiles(zip, ASSETS_DIR_PREFIX)
    const manifest = await readManifest(zip, errors)
    if (manifest) {
      errors.push(...validateManifest(manifest, files))
    }
    return { csvText, assetFiles: files, manifest, errors }
  }

  if (input.extraZipBuffer) {
    const zip = await JSZip.loadAsync(input.extraZipBuffer)
    const { files, errors } = await extractAssetFiles(zip, null)
    const manifest = await readManifest(zip, errors)
    if (manifest) {
      errors.push(...validateManifest(manifest, files))
    }
    return { csvText: input.csvText ?? '', assetFiles: files, manifest, errors }
  }

  return { csvText: input.csvText ?? '', assetFiles: new Map(), manifest: null, errors: [] }
}

/**
 * Case-insensitive lookup of an uploaded file by ref (relative path or bare filename).
 *
 * A CSV ref is normally a full package path, e.g. "assets/ts-pattern-001/option-a.png", while the
 * extractor stores keys as the relative path with any leading `assets/` stripped (see
 * extractAssetFiles) — so the ref is matched on its FULL path FIRST, both as-is and with `assets/`
 * removed. The bare-filename fallback is used only when a filename is UNIQUE across the package:
 * multi-question packages repeat basenames (question.png, option-a.png, solution.png) across every
 * folder, and guessing the first match there silently links the wrong image. An ambiguous basename
 * is therefore treated as unresolved rather than resolved to an arbitrary file.
 */
export function findUploadedAssetFile(
  assetFiles: Map<string, UploadedAssetFile>,
  ref: string
): UploadedAssetFile | null {
  const trimmed = ref.trim()
  if (!trimmed) {
    return null
  }

  // Normalise to a package-relative, lowercase key: backslashes → '/', drop a leading './' or '/'.
  const base = trimmed.replace(/\\/g, '/').replace(/^\.?\//, '').toLowerCase()
  const stripped = base.replace(/^assets\//, '')

  // Full-path match: try the ref verbatim (assets-only zips keep the `assets/` prefix in the key)
  // and with the prefix stripped (single-zip packages have it removed). Path match is unambiguous.
  const direct = assetFiles.get(base) ?? (stripped !== base ? assetFiles.get(stripped) : undefined)
  if (direct) {
    return direct
  }

  // Bare-filename fallback — accepted only when exactly one file carries that basename.
  const basename = path.posix.basename(base)
  let match: UploadedAssetFile | null = null
  for (const file of assetFiles.values()) {
    if (file.filename.toLowerCase() === basename) {
      if (match) {
        return null // Ambiguous: more than one file shares this basename — refuse to guess.
      }
      match = file
    }
  }
  return match
}
