import path from 'node:path'

import JSZip from 'jszip'

import type { UploadedAssetFile } from '@/lib/import/types'

export interface ParsedImportPackage {
  csvText: string
  assetFiles: Map<string, UploadedAssetFile>
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
 * Parses the three supported import shapes: CSV text alone; CSV text + a separate assets-only
 * zip; or one zip containing a root `.csv` file plus an `assets/` directory. Never writes to
 * disk — everything stays as in-memory buffers keyed by a sanitised relative path.
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
        errors: ['The zip must contain a .csv file at its root (e.g. questions.csv).'],
      }
    }

    const csvText = await zip.files[csvEntryName].async('string')
    const { files, errors } = await extractAssetFiles(zip, ASSETS_DIR_PREFIX)
    return { csvText, assetFiles: files, errors }
  }

  if (input.extraZipBuffer) {
    const zip = await JSZip.loadAsync(input.extraZipBuffer)
    const { files, errors } = await extractAssetFiles(zip, null)
    return { csvText: input.csvText ?? '', assetFiles: files, errors }
  }

  return { csvText: input.csvText ?? '', assetFiles: new Map(), errors: [] }
}

/** Case-insensitive lookup of an uploaded file by ref (filename or relative path). */
export function findUploadedAssetFile(
  assetFiles: Map<string, UploadedAssetFile>,
  ref: string
): UploadedAssetFile | null {
  const trimmed = ref.trim()
  if (!trimmed) {
    return null
  }
  const direct = assetFiles.get(trimmed.toLowerCase())
  if (direct) {
    return direct
  }
  const basename = path.posix.basename(trimmed).toLowerCase()
  for (const file of assetFiles.values()) {
    if (file.filename.toLowerCase() === basename) {
      return file
    }
  }
  return null
}
