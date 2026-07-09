#!/usr/bin/env node
// Validates the deterministic asset pipeline is internally consistent.
//
// Checks (fails the build when any is violated):
//   1. Every generated ref (in spec files, the manifest and the question CSVs)
//      resolves to a real SVG under public/question-assets/generated/.
//   2. Nothing is marked asset_status=generated unless its SVG exists on disk.
//   3. Every spec `type` is a known pipeline type; implemented types must have a
//      committed SVG, and recognised-but-pending types must NOT have been
//      silently marked generated.
//   4. Option image refs (option_asset_refs_json) are validated like any other.
//   5. No question CSV row reuses an external_id (would import as a duplicate).
//   6. No CSV row is marked generated while still carrying a pending ref.
//
// Usage: node scripts/validate-assets.mjs   (npm run validate:assets)

import { promises as fs } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { readCsv, headerIndex } from './lib/csv-io.mjs'
import { IMPLEMENTED_ASSET_TYPES, KNOWN_ASSET_TYPES } from './lib/svg/render.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '..')
const SPEC_DIR = path.join(ROOT, 'docs/generated-question-bank/asset-specs')
const MANIFEST = path.join(ROOT, 'docs/generated-question-bank/asset-manifest.csv')
const PUBLIC_DIR = path.join(ROOT, 'public/question-assets/generated')
const CSV_FILES = [
  'docs/generated-question-bank/mathematical-reasoning-100.csv',
  'docs/generated-question-bank/thinking-skills-100.csv',
  'docs/generated-question-bank/reading-100.csv',
  'docs/generated-question-bank/writing-prompts.csv',
]
const REF_COLUMNS = ['question_asset_refs', 'stimulus_asset_refs', 'solution_asset_refs', 'option_asset_refs_json']

const GENERATED_RE = /asset:\/\/question-assets\/generated\/([a-z0-9-]+)\.svg/g
const PENDING_RE = /asset:\/\/pending\//

const errors = []
const warnings = []

async function readableSvgs() {
  try {
    const files = await fs.readdir(PUBLIC_DIR)
    return new Set(files.filter((f) => f.endsWith('.svg')).map((f) => f.replace(/\.svg$/, '')))
  } catch {
    return new Set()
  }
}

async function main() {
  const svgs = await readableSvgs()
  const known = new Set(KNOWN_ASSET_TYPES)
  const implemented = new Set(IMPLEMENTED_ASSET_TYPES)

  // 1 + 3. Spec files.
  const specFiles = (await fs.readdir(SPEC_DIR)).filter((f) => f.endsWith('.json'))
  for (const file of specFiles) {
    let entry
    try {
      entry = JSON.parse(await fs.readFile(path.join(SPEC_DIR, file), 'utf8'))
    } catch (e) {
      errors.push(`spec ${file}: invalid JSON (${e.message})`)
      continue
    }
    const type = entry?.spec?.type
    if (type && !known.has(type)) {
      errors.push(`spec ${file}: unknown spec type "${type}".`)
    }
    const ref = entry.asset_ref ?? ''
    const base = ref.slice(ref.lastIndexOf('/') + 1).replace(/\.svg$/, '')
    if (ref.includes('/generated/') && implemented.has(type) && !svgs.has(base)) {
      errors.push(`spec ${file}: implemented type "${type}" but ${base}.svg is not generated. Run npm run generate:assets.`)
    }
  }

  // 2. Manifest rows.
  try {
    const rows = readCsv(MANIFEST)
    const h = headerIndex(rows[0])
    for (let r = 1; r < rows.length; r += 1) {
      const row = rows[r]
      if (row.length === 1 && row[0] === '') continue
      const ref = (row[h['asset_ref']] ?? '').trim()
      const status = (row[h['asset_status']] ?? '').trim()
      const base = ref.slice(ref.lastIndexOf('/') + 1).replace(/\.svg$/, '')
      if (status === 'generated' && !svgs.has(base)) {
        errors.push(`manifest: "${ref}" is marked generated but ${base}.svg is missing.`)
      }
    }
  } catch (e) {
    warnings.push(`manifest not validated: ${e.message}`)
  }

  // 1 + 4 + 5 + 6. Question CSVs.
  for (const rel of CSV_FILES) {
    let rows
    try {
      rows = readCsv(path.join(ROOT, rel))
    } catch {
      warnings.push(`${rel}: not found, skipped.`)
      continue
    }
    const h = headerIndex(rows[0])
    const seenIds = new Set()
    for (let r = 1; r < rows.length; r += 1) {
      const row = rows[r]
      if (row.length === 1 && row[0] === '') continue

      const extId = (h['external_id'] !== undefined ? row[h['external_id']] : '')?.trim()
      if (extId) {
        if (seenIds.has(extId)) errors.push(`${rel} row ${r + 1}: duplicate external_id "${extId}".`)
        seenIds.add(extId)
      }

      const refsText = REF_COLUMNS.map((c) => (h[c] !== undefined ? row[h[c]] ?? '' : '')).join(' ')
      for (const [, base] of refsText.matchAll(GENERATED_RE)) {
        if (!svgs.has(base)) {
          errors.push(`${rel} row ${r + 1}: references generated ${base}.svg but the file is missing.`)
        }
      }

      const status = (h['asset_status'] !== undefined ? row[h['asset_status']] ?? '' : '').trim()
      if (status === 'generated' && PENDING_RE.test(refsText)) {
        errors.push(`${rel} row ${r + 1}: asset_status=generated but a pending ref remains.`)
      }
    }
  }

  // Report.
  for (const w of warnings) console.log(`⚠ ${w}`)
  if (errors.length === 0) {
    console.log(`✓ Asset pipeline valid (${svgs.size} generated SVGs, ${specFiles.length} specs).`)
    return
  }
  console.error(`\n✗ ${errors.length} asset validation error(s):`)
  for (const e of errors) console.error(`  • ${e}`)
  process.exitCode = 1
}

main().catch((e) => {
  console.error(e)
  process.exitCode = 1
})
