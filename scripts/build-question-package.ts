#!/usr/bin/env node
/**
 * Builds a question-import package (question-pack.zip) from an input CSV, generating any missing
 * diagram assets and assembling every referenced image into one ZIP the admin importer accepts.
 *
 * Pipeline (see the task spec):
 *   1. read the input CSV                     6. optionally invoke an image provider (adapter)
 *   2. validate every row                     7. save generated files under assets/{id}/…
 *   3. find rows that need assets             8. rewrite the CSV asset-ref cells to those paths
 *   4. read asset_spec_json / prompt          9. verify every referenced file exists
 *   5. compute deterministic asset paths     10. write manifest.json → 11. produce the ZIP
 *
 * Providers are pluggable through the AssetGenerator interface:
 *   --provider diagram   (default) deterministic SVG from asset_spec_json via scripts/lib/svg.
 *   --provider external  boundary for an external raster (PNG) API; reads IMAGE_GENERATION_* env
 *                        vars (never hardcoded) and errors clearly when unconfigured.
 *
 * Usage:
 *   node --experimental-strip-types scripts/build-question-package.ts \
 *     --csv docs/generated-question-bank/bank.csv --out dist/question-pack.zip \
 *     [--assets-dir path/to/existing/images] [--provider diagram|external]
 */
import { createHash } from 'node:crypto'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import JSZip from 'jszip'

import { IMPLEMENTED_ASSET_TYPES, renderAssetSpec } from './lib/svg/render.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '..')

// ---------------------------------------------------------------------------
// Provider interface + adapters
// ---------------------------------------------------------------------------

export interface AssetGenerationRequest {
  externalId: string
  /** stimulus | question | solution | option-a … */
  role: string
  spec: Record<string, unknown> | null
  prompt: string | null
  altText: string | null
}

export interface GeneratedAsset {
  buffer: Buffer
  /** File extension without the dot, e.g. "svg" or "png". */
  extension: string
  mimeType: string
  width?: number
  height?: number
}

export interface AssetGenerator {
  readonly name: string
  generate(input: AssetGenerationRequest): Promise<GeneratedAsset>
}

/**
 * Deterministic diagram provider: renders a structured asset_spec_json to an SVG through the
 * existing scripts/lib/svg pipeline. No network, no AI — the same spec always yields identical
 * bytes. Refuses (throws) when a spec is absent or names an unimplemented diagram type, so a
 * package never ships a wrong/guessed diagram.
 */
export const diagramGenerator: AssetGenerator = {
  name: 'diagram',
  async generate(input) {
    if (!input.spec) {
      throw new Error(`Row "${input.externalId}" (${input.role}) has no asset_spec_json to render a diagram from.`)
    }
    const type = String(input.spec.type ?? '')
    if (!IMPLEMENTED_ASSET_TYPES.includes(type)) {
      throw new Error(
        `Row "${input.externalId}" (${input.role}) spec type "${type}" is not an implemented diagram type ` +
          `(${IMPLEMENTED_ASSET_TYPES.join(', ')}).`
      )
    }
    const svg = renderAssetSpec(input.spec)
    return { buffer: Buffer.from(svg, 'utf8'), extension: 'svg', mimeType: 'image/svg+xml' }
  },
}

/**
 * External raster provider BOUNDARY. This is intentionally a documented adapter that reads its
 * configuration from environment variables and never hardcodes a credential. Wire the actual HTTP
 * call to your image API here; until IMAGE_GENERATION_* is configured it throws a clear error so
 * `--provider external` fails loudly rather than silently producing nothing.
 */
export const externalRasterGenerator: AssetGenerator = {
  name: 'external',
  async generate(input) {
    const provider = process.env.IMAGE_GENERATION_PROVIDER
    const apiUrl = process.env.IMAGE_GENERATION_API_URL
    const apiKey = process.env.IMAGE_GENERATION_API_KEY
    if (!provider || !apiUrl || !apiKey) {
      throw new Error(
        'External raster generation is not configured. Set IMAGE_GENERATION_PROVIDER, ' +
          'IMAGE_GENERATION_API_URL and IMAGE_GENERATION_API_KEY (see .env.example), then implement ' +
          'the HTTP call in externalRasterGenerator.generate().'
      )
    }
    // Adapter boundary — a real implementation would POST input.prompt to `apiUrl` with `apiKey`
    // and return the decoded PNG bytes. Left unimplemented so no provider is assumed/hardcoded.
    throw new Error(
      `externalRasterGenerator is a boundary: implement the ${provider} call for ` +
        `"${input.externalId}" (${input.role}) before using --provider external.`
    )
  },
}

const GENERATORS: Record<string, AssetGenerator> = {
  diagram: diagramGenerator,
  external: externalRasterGenerator,
}

// ---------------------------------------------------------------------------
// Minimal RFC-4180 CSV read/write (self-contained: scripts avoid `@/` imports)
// ---------------------------------------------------------------------------

function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i]
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i += 1
        } else {
          inQuotes = false
        }
      } else {
        field += char
      }
    } else if (char === '"') {
      inQuotes = true
    } else if (char === ',') {
      row.push(field)
      field = ''
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i += 1
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else {
      field += char
    }
  }
  if (field !== '' || row.length > 0) {
    row.push(field)
    rows.push(row)
  }
  return rows.filter((r) => r.some((cell) => cell.trim() !== ''))
}

function csvCell(value: string): string {
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
}

function toCsv(rows: string[][]): string {
  return rows.map((row) => row.map(csvCell).join(',')).join('\n') + '\n'
}

// ---------------------------------------------------------------------------
// Build pipeline
// ---------------------------------------------------------------------------

const MIME_BY_EXT: Record<string, string> = {
  svg: 'image/svg+xml',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
}

interface ManifestAssetEntry {
  external_id: string
  role: string
  option_key?: string
  path: string
  mime_type: string
  size_bytes: number
  checksum: string
  alt_text?: string
}

function parseArgs(argv: string[]): Record<string, string> {
  const args: Record<string, string> = {}
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i].startsWith('--')) {
      const key = argv[i].slice(2)
      const value = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[(i += 1)] : 'true'
      args[key] = value
    }
  }
  return args
}

function looksGenerable(ref: string): boolean {
  return ref.startsWith('asset://pending/') || (!/^https?:\/\//i.test(ref) && !ref.startsWith('asset://'))
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const csvPath = args.csv
  const outPath = args.out ?? 'question-pack.zip'
  const assetsDir = args['assets-dir'] ? path.resolve(ROOT, args['assets-dir']) : null
  const generator = GENERATORS[args.provider ?? 'diagram']

  if (!csvPath) {
    throw new Error('Missing --csv <input.csv>. See the header of this file for usage.')
  }
  if (!generator) {
    throw new Error(`Unknown --provider "${args.provider}". Use "diagram" or "external".`)
  }

  const csvText = await fs.readFile(path.resolve(ROOT, csvPath), 'utf8')
  const table = parseCsv(csvText)
  if (table.length < 2) {
    throw new Error('CSV needs a header row and at least one data row.')
  }

  const header = table[0].map((h) => h.trim().toLowerCase())
  const col = (name: string) => header.indexOf(name)
  const idIdx = col('external_id')
  if (idIdx === -1) {
    throw new Error('CSV must have an external_id column.')
  }
  const specIdx = col('asset_spec_json')
  const promptIdx = col('asset_generation_prompt')
  const altIdx = col('asset_alt_text')
  const questionRefIdx = col('question_asset_refs')

  const zip = new JSZip()
  const manifestAssets: ManifestAssetEntry[] = []
  const referencedPaths = new Set<string>()
  const errors: string[] = []
  let generatedCount = 0

  // Rows: validate, generate the question diagram where a spec is present, collect referenced files.
  for (let r = 1; r < table.length; r += 1) {
    const row = table[r]
    const externalId = (row[idIdx] ?? '').trim()
    if (!externalId) {
      errors.push(`Row ${r + 1}: missing external_id.`)
      continue
    }

    const spec = specIdx !== -1 && row[specIdx]?.trim() ? safeJson(row[specIdx]) : null
    const prompt = promptIdx !== -1 ? row[promptIdx]?.trim() || null : null
    const altText = altIdx !== -1 ? row[altIdx]?.trim() || null : null
    const currentQuestionRef = questionRefIdx !== -1 ? (row[questionRefIdx] ?? '').trim() : ''

    // Generate the question diagram when a spec is present and no committed file is referenced yet.
    if (spec && questionRefIdx !== -1 && (!currentQuestionRef || looksGenerable(currentQuestionRef))) {
      try {
        const asset = await generator.generate({ externalId, role: 'question', spec, prompt, altText })
        const relPath = `assets/${externalId}/question.${asset.extension}`
        zip.file(relPath, asset.buffer)
        referencedPaths.add(relPath)
        row[questionRefIdx] = relPath
        manifestAssets.push(buildManifestEntry(externalId, 'question', relPath, asset, altText))
        generatedCount += 1
      } catch (error) {
        errors.push(error instanceof Error ? error.message : String(error))
      }
    }

    // Copy already-referenced local files (relative paths) from --assets-dir into the package.
    const copyLocalRef = async (ref: string, role: string) => {
      const trimmed = ref.trim()
      if (!trimmed || referencedPaths.has(trimmed) || !looksGenerable(trimmed) || trimmed.startsWith('asset://')) return
      if (!assetsDir) return
      const source = path.resolve(assetsDir, trimmed.replace(/^assets\//, ''))
      try {
        const buffer = await fs.readFile(source)
        const relPath = trimmed.startsWith('assets/') ? trimmed : `assets/${externalId}/${path.basename(trimmed)}`
        zip.file(relPath, buffer)
        referencedPaths.add(relPath)
        const ext = path.extname(relPath).slice(1).toLowerCase()
        manifestAssets.push(
          buildManifestEntry(
            externalId,
            role,
            relPath,
            { buffer, extension: ext, mimeType: MIME_BY_EXT[ext] ?? 'application/octet-stream' },
            altText
          )
        )
      } catch {
        errors.push(`Row ${r + 1}: referenced asset "${trimmed}" not found under --assets-dir.`)
      }
    }

    for (const refCol of ['stimulus_asset_refs', 'question_asset_refs', 'solution_asset_refs']) {
      const idx = col(refCol)
      if (idx !== -1) await copyLocalRef(row[idx] ?? '', refCol.replace('_asset_refs', ''))
    }

    // Option images: option_asset_refs_json is { "A": "ref" | ["ref", …], … }.
    const optionIdx = col('option_asset_refs_json')
    if (optionIdx !== -1 && row[optionIdx]?.trim()) {
      const optionMap = safeJson(row[optionIdx])
      for (const [label, value] of Object.entries(optionMap ?? {})) {
        const refs = Array.isArray(value) ? value : [value]
        for (const ref of refs) {
          if (typeof ref === 'string') await copyLocalRef(ref, `option-${label.toLowerCase()}`)
        }
      }
    }
  }

  if (errors.length > 0) {
    console.error('Package build found problems:')
    for (const message of errors) console.error(`  • ${message}`)
    throw new Error(`${errors.length} problem(s) — fix them and rebuild.`)
  }

  const rewrittenCsv = toCsv(table)
  zip.file('questions.csv', rewrittenCsv)

  const manifest = {
    package_version: '1.0',
    generated_at: new Date().toISOString(),
    question_count: table.length - 1,
    asset_count: manifestAssets.length,
    csv_filename: 'questions.csv',
    package_checksum: createHash('sha256').update(rewrittenCsv).digest('hex'),
    assets: manifestAssets,
  }
  zip.file('manifest.json', JSON.stringify(manifest, null, 2))

  const outBuffer = await zip.generateAsync({ type: 'nodebuffer' })
  const resolvedOut = path.resolve(ROOT, outPath)
  await fs.mkdir(path.dirname(resolvedOut), { recursive: true })
  await fs.writeFile(resolvedOut, outBuffer)

  console.log(
    `Built ${path.relative(ROOT, resolvedOut)} — ${manifest.question_count} question(s), ` +
      `${manifest.asset_count} asset(s) (${generatedCount} generated via "${generator.name}").`
  )
}

function buildManifestEntry(
  externalId: string,
  role: string,
  relPath: string,
  asset: { buffer: Buffer; mimeType: string; extension?: string; width?: number; height?: number },
  altText: string | null
): ManifestAssetEntry {
  return {
    external_id: externalId,
    role,
    path: relPath,
    mime_type: asset.mimeType,
    size_bytes: asset.buffer.length,
    checksum: createHash('sha256').update(asset.buffer).digest('hex'),
    ...(altText ? { alt_text: altText } : {}),
  }
}

function safeJson(value: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(value)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null
  } catch {
    return null
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
