#!/usr/bin/env node
// Deterministic question-asset generator.
//
// Reads structured specs from docs/generated-question-bank/asset-specs/*.json,
// renders each to an SVG under public/question-assets/generated/, and rewrites
// the asset manifest at docs/generated-question-bank/asset-manifest.csv.
//
// Usage:
//   npm run generate:assets
//   node scripts/generate-assets.mjs            # all specs
//   node scripts/generate-assets.mjs mr4-001    # only specs whose external_id/file matches
//
// Design notes:
//   * No AI image generation — every diagram is drawn from an explicit spec, so
//     the same spec always yields byte-identical output (reviewable in git).
//   * A spec whose type is recognised but not yet implemented is reported and
//     skipped, never emitted as a wrong diagram.

import { promises as fs } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { renderAssetSpec } from './lib/svg/render.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '..')
const SPEC_DIR = path.join(ROOT, 'docs', 'generated-question-bank', 'asset-specs')
const OUT_DIR = path.join(ROOT, 'public', 'question-assets', 'generated')
const MANIFEST = path.join(ROOT, 'docs', 'generated-question-bank', 'asset-manifest.csv')

// Public URL prefix that `asset://question-assets/...` refs resolve to (see
// src/lib/assets/refs.ts — kept in sync deliberately).
const PUBLIC_PREFIX = '/question-assets/'
const REF_SCHEME = 'asset://question-assets/'

const MANIFEST_HEADERS = [
  'asset_ref',
  'external_id',
  'asset_type',
  'asset_status',
  'storage_path',
  'spec_file',
  'alt_text',
]

function escapeCsv(value) {
  const str = String(value ?? '')
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str
}

/** Maps an `asset://question-assets/<path>` ref to its served public URL. */
function refToPublicPath(ref) {
  if (!ref?.startsWith(REF_SCHEME)) {
    throw new Error(`asset_ref must start with "${REF_SCHEME}" — got "${ref}".`)
  }
  return PUBLIC_PREFIX + ref.slice(REF_SCHEME.length)
}

/** Derives the on-disk filename (basename of the ref) and validates it is an .svg. */
function refToFilename(ref) {
  const name = ref.slice(ref.lastIndexOf('/') + 1)
  if (!name.endsWith('.svg')) {
    throw new Error(`Generated asset_ref must end in .svg — got "${ref}".`)
  }
  return name
}

async function main() {
  const filter = process.argv[2] ?? null

  const specFiles = (await fs.readdir(SPEC_DIR))
    .filter((file) => file.endsWith('.json'))
    .sort()

  await fs.mkdir(OUT_DIR, { recursive: true })

  const manifestRows = []
  const generated = []
  const skipped = []
  const failed = []

  for (const file of specFiles) {
    const raw = await fs.readFile(path.join(SPEC_DIR, file), 'utf8')
    let entry
    try {
      entry = JSON.parse(raw)
    } catch (error) {
      failed.push({ file, message: `invalid JSON: ${error.message}` })
      continue
    }

    const externalId = entry.external_id ?? file.replace(/\.json$/, '')
    if (filter && !file.includes(filter) && externalId !== filter) {
      continue
    }

    const ref = entry.asset_ref
    let filename
    let publicPath
    try {
      filename = refToFilename(ref)
      publicPath = refToPublicPath(ref)
    } catch (error) {
      failed.push({ file, message: error.message })
      continue
    }

    let svg
    try {
      svg = renderAssetSpec(entry.spec)
    } catch (error) {
      if (error.notImplemented) {
        skipped.push({ file, message: error.message })
      } else {
        failed.push({ file, message: error.message })
      }
      continue
    }

    await fs.writeFile(path.join(OUT_DIR, filename), `${svg}\n`, 'utf8')
    generated.push({ ref, filename })

    manifestRows.push([
      ref,
      externalId,
      entry.asset_type ?? 'svg',
      'generated',
      publicPath,
      path.posix.join('docs/generated-question-bank/asset-specs', file),
      entry.alt_text ?? entry.spec?.alt_text ?? '',
    ])
  }

  // Manifest is sorted by ref for a stable diff.
  manifestRows.sort((a, b) => a[0].localeCompare(b[0]))
  const manifestCsv =
    [MANIFEST_HEADERS.join(','), ...manifestRows.map((row) => row.map(escapeCsv).join(','))].join('\n') + '\n'
  await fs.writeFile(MANIFEST, manifestCsv, 'utf8')

  // Report.
  console.log(`Generated ${generated.length} asset(s) → ${path.relative(ROOT, OUT_DIR)}`)
  for (const { ref, filename } of generated) {
    console.log(`  ✓ ${filename}  (${ref})`)
  }
  if (skipped.length) {
    console.log(`\nSkipped ${skipped.length} (generator not implemented yet):`)
    for (const { file, message } of skipped) console.log(`  • ${file}: ${message}`)
  }
  if (failed.length) {
    console.log(`\nFailed ${failed.length}:`)
    for (const { file, message } of failed) console.log(`  ✗ ${file}: ${message}`)
  }
  console.log(`\nManifest written → ${path.relative(ROOT, MANIFEST)}`)

  if (failed.length) {
    process.exitCode = 1
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
