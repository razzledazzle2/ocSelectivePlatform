#!/usr/bin/env node
// Builds the sample question package ZIP from the committed loose fixture files.
//
//   node scripts/build-fixture-package.mjs
//
// Source of truth: docs/fixtures/question-pack-sample/ (questions.csv + assets/**, all text SVG,
// generated art only — no copyrighted exam imagery). This script adds a manifest.json with correct
// checksums and writes docs/fixtures/question-pack-sample.zip for admins to try in the importer.

import { createHash } from 'node:crypto'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import JSZip from 'jszip'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '..')
const FIXTURE_DIR = path.join(ROOT, 'docs', 'fixtures', 'question-pack-sample')
const OUT_ZIP = path.join(ROOT, 'docs', 'fixtures', 'question-pack-sample.zip')

const MIME_BY_EXT = { svg: 'image/svg+xml', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp' }

async function walk(dir, base = dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...(await walk(full, base)))
    } else {
      files.push({ rel: path.relative(base, full).split(path.sep).join('/'), full })
    }
  }
  return files
}

async function main() {
  const files = await walk(FIXTURE_DIR)
  const zip = new JSZip()
  const assets = []

  for (const file of files) {
    const buffer = await fs.readFile(file.full)
    zip.file(file.rel, buffer)
    if (file.rel.startsWith('assets/')) {
      const ext = path.extname(file.rel).slice(1).toLowerCase()
      const externalId = file.rel.split('/')[1] ?? ''
      const role = path.basename(file.rel, path.extname(file.rel))
      assets.push({
        external_id: externalId,
        role,
        path: file.rel,
        mime_type: MIME_BY_EXT[ext] ?? 'application/octet-stream',
        size_bytes: buffer.length,
        checksum: createHash('sha256').update(buffer).digest('hex'),
      })
    }
  }

  const csvBuffer = await fs.readFile(path.join(FIXTURE_DIR, 'questions.csv'))
  const manifest = {
    package_version: '1.0',
    generated_at: '1970-01-01T00:00:00.000Z', // fixed so the fixture zip is reproducible
    question_count: csvBuffer.toString('utf8').trim().split('\n').length - 1,
    asset_count: assets.length,
    csv_filename: 'questions.csv',
    package_checksum: createHash('sha256').update(csvBuffer).digest('hex'),
    assets,
  }
  zip.file('manifest.json', JSON.stringify(manifest, null, 2))

  const buffer = await zip.generateAsync({ type: 'nodebuffer' })
  await fs.writeFile(OUT_ZIP, buffer)
  console.log(`Built ${path.relative(ROOT, OUT_ZIP)} — ${manifest.question_count} questions, ${manifest.asset_count} assets.`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
