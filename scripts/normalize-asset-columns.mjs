#!/usr/bin/env node
// Normalises asset metadata across the generated question-bank CSVs.
//
// For every row that needs a visual asset it ensures:
//   - asset_spec_json  — the structured spec the diagram is (re)built from
//   - asset_status      — 'generated' iff the SVG file actually exists, else 'pending'
// and leaves asset_generation_prompt / asset_alt_text / *_asset_refs as authored.
//
// Sources of specs:
//   - docs/generated-question-bank/asset-specs/*.json  (generatable; SVG exists)
//   - docs/generated-question-bank/pending-specs.json  (no generator yet; stays pending)
//
// Idempotent: safe to re-run. Never marks a row 'generated' unless its SVG is on disk.
//
// Usage: node scripts/normalize-asset-columns.mjs

import { promises as fs } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { readCsv, writeCsv, headerIndex } from './lib/csv-io.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '..')
const SPEC_DIR = path.join(ROOT, 'docs/generated-question-bank/asset-specs')
const PENDING_SPECS = path.join(ROOT, 'docs/generated-question-bank/pending-specs.json')
const PUBLIC_DIR = path.join(ROOT, 'public/question-assets/generated')

const FILES = [
  'docs/generated-question-bank/mathematical-reasoning-100.csv',
  'docs/generated-question-bank/thinking-skills-100.csv',
  'docs/generated-question-bank/reading-100.csv',
  'docs/generated-question-bank/writing-prompts.csv',
]

const REF_COLUMNS = ['question_asset_refs', 'stimulus_asset_refs', 'solution_asset_refs', 'option_asset_refs_json']
const baseOf = (ref) => ref.slice(ref.lastIndexOf('/') + 1).replace(/\.svg$/, '')

async function main() {
  // 1. Load generatable specs, keyed by generated-file basename; only those whose SVG exists.
  const existingSvgs = new Set(
    (await fs.readdir(PUBLIC_DIR)).filter((f) => f.endsWith('.svg')).map((f) => f.replace(/\.svg$/, ''))
  )
  const genSpecByBase = new Map()
  for (const file of (await fs.readdir(SPEC_DIR)).filter((f) => f.endsWith('.json'))) {
    const entry = JSON.parse(await fs.readFile(path.join(SPEC_DIR, file), 'utf8'))
    const base = baseOf(entry.asset_ref ?? '')
    if (base && existingSvgs.has(base)) {
      genSpecByBase.set(base, entry.spec)
    }
  }

  // 2. Load pending specs, keyed by question external_id.
  const pending = JSON.parse(await fs.readFile(PENDING_SPECS, 'utf8'))
  const pendingByExtId = new Map(Object.entries(pending).filter(([k]) => !k.startsWith('_')))

  const report = { visual: 0, withSpec: 0, generated: 0, pendingRows: 0, byFile: {} }

  for (const rel of FILES) {
    const abs = path.join(ROOT, rel)
    const rows = readCsv(abs)
    let header = headerIndex(rows[0])

    // 3. Ensure asset_spec_json + asset_status columns exist (inserted before `status`).
    const ensureColumn = (name) => {
      if (name in header) return
      const at = 'status' in header ? header['status'] : rows[0].length
      rows[0].splice(at, 0, name)
      for (let r = 1; r < rows.length; r += 1) {
        if (rows[r].length === 1 && rows[r][0] === '') continue
        rows[r].splice(at, 0, '')
      }
      header = headerIndex(rows[0])
    }
    ensureColumn('asset_spec_json')
    ensureColumn('asset_status')

    const idx = (name) => header[name]
    const cell = (row, name) => (idx(name) === undefined ? '' : (row[idx(name)] ?? '').trim())
    const setCell = (row, name, value) => {
      if (idx(name) !== undefined) row[idx(name)] = value
    }

    let fileVisual = 0
    let fileGenerated = 0
    let filePending = 0

    for (let r = 1; r < rows.length; r += 1) {
      const row = rows[r]
      if (row.length === 1 && row[0] === '') continue

      // Wire refs: swap any pending ref whose SVG now exists to the generated URL.
      // Operates on raw cell text so it also rewrites refs inside option JSON.
      for (const col of REF_COLUMNS) {
        if (idx(col) === undefined) continue
        const before = row[idx(col)] ?? ''
        const after = before.replace(
          /asset:\/\/pending\/([a-z0-9-]+)\.(?:png|svg)/g,
          (match, base) => (existingSvgs.has(base) ? `asset://question-assets/generated/${base}.svg` : match)
        )
        if (after !== before) row[idx(col)] = after
      }

      const refsText = REF_COLUMNS.map((c) => cell(row, c)).join(' ')
      const prompt = cell(row, 'asset_generation_prompt')
      const isVisual = Boolean(refsText.trim()) || Boolean(prompt)
      if (!isVisual) continue
      fileVisual += 1

      const hasPending = /asset:\/\/pending\//.test(refsText)
      const generatedBases = [...refsText.matchAll(/asset:\/\/question-assets\/generated\/([a-z0-9-]+)\.svg/g)].map(
        (m) => m[1]
      )
      const hasGenerated = generatedBases.length > 0

      // Status: generated only when every asset resolves to an existing SVG.
      const status = hasGenerated && !hasPending ? 'generated' : 'pending'
      setCell(row, 'asset_status', status)

      // Spec: prefer the question-level generated spec; else any generated ref's spec;
      // else the authored pending spec keyed by external_id.
      const extId = cell(row, 'external_id')
      const questionBases = [
        ...cell(row, 'question_asset_refs').matchAll(/generated\/([a-z0-9-]+)\.svg/g),
      ].map((m) => m[1])
      let spec = null
      for (const base of [...questionBases, ...generatedBases]) {
        if (genSpecByBase.has(base)) {
          spec = genSpecByBase.get(base)
          break
        }
      }
      if (!spec && pendingByExtId.has(extId)) {
        spec = pendingByExtId.get(extId)
      }
      if (spec) {
        setCell(row, 'asset_spec_json', JSON.stringify(spec))
        report.withSpec += 1
      }

      if (status === 'generated') fileGenerated += 1
      else filePending += 1
    }

    writeCsv(abs, rows)
    report.visual += fileVisual
    report.generated += fileGenerated
    report.pendingRows += filePending
    report.byFile[rel] = { visual: fileVisual, generated: fileGenerated, pending: filePending }
    console.log(`${rel}: ${fileVisual} visual (${fileGenerated} generated, ${filePending} pending)`)
  }

  console.log('\n=== SUMMARY ===')
  console.log(`visual rows: ${report.visual}`)
  console.log(`with asset_spec_json: ${report.withSpec}`)
  console.log(`generated rows: ${report.generated}`)
  console.log(`pending rows: ${report.pendingRows}`)
}

main().catch((e) => {
  console.error(e)
  process.exitCode = 1
})
