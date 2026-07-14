/**
 * Unit tests for the import asset-package parser: the three supported shapes (CSV alone,
 * CSV + separate assets zip, single zip with a root CSV + assets/ dir), path-traversal
 * rejection, and duplicate-filename detection. In-memory only — never touches disk.
 * Run with: node --test --experimental-strip-types "src/lib/import/*.test.ts" (wired to `npm test`).
 */
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { test } from 'node:test'

import JSZip from 'jszip'

import { findUploadedAssetFile, parseImportPackage } from './asset-package.ts'

test('CSV text alone parses with an empty asset map', async () => {
  const result = await parseImportPackage({ csvText: 'external_id,question_text\nq-1,hi\n' })
  assert.equal(result.csvText, 'external_id,question_text\nq-1,hi\n')
  assert.equal(result.assetFiles.size, 0)
  assert.deepEqual(result.errors, [])
})

test('CSV text + a separate assets-only zip extracts every file, keyed by lowercase relative path', async () => {
  const zip = new JSZip()
  zip.file('mr-area-001.svg', '<svg xmlns="http://www.w3.org/2000/svg"></svg>')
  zip.file('nested/ts-matrix-003.svg', '<svg xmlns="http://www.w3.org/2000/svg"></svg>')
  const buffer = await zip.generateAsync({ type: 'nodebuffer' })

  const result = await parseImportPackage({ csvText: 'a,b\n1,2\n', extraZipBuffer: buffer })
  assert.equal(result.csvText, 'a,b\n1,2\n')
  assert.equal(result.assetFiles.size, 2)
  assert.ok(result.assetFiles.has('mr-area-001.svg'))
  assert.ok(result.assetFiles.has('nested/ts-matrix-003.svg'))
  assert.equal(result.assetFiles.get('mr-area-001.svg').filename, 'mr-area-001.svg')
})

test('a single zip with a root questions.csv plus an assets/ dir splits the two apart', async () => {
  const zip = new JSZip()
  zip.file('questions.csv', 'external_id,question_text\nq-1,hi\n')
  zip.file('assets/mr-area-001.svg', '<svg xmlns="http://www.w3.org/2000/svg"></svg>')
  zip.file('assets/ts-matrix-003.svg', '<svg xmlns="http://www.w3.org/2000/svg"></svg>')
  const buffer = await zip.generateAsync({ type: 'nodebuffer' })

  const result = await parseImportPackage({ zipBuffer: buffer })
  assert.equal(result.csvText, 'external_id,question_text\nq-1,hi\n')
  assert.equal(result.assetFiles.size, 2)
  assert.ok(result.assetFiles.has('mr-area-001.svg'))
  assert.ok(result.assetFiles.has('ts-matrix-003.svg'))
})

test('a zip with no root CSV is rejected with a clear error, not a crash', async () => {
  const zip = new JSZip()
  zip.file('assets/mr-area-001.svg', '<svg></svg>')
  const buffer = await zip.generateAsync({ type: 'nodebuffer' })

  const result = await parseImportPackage({ zipBuffer: buffer })
  assert.equal(result.csvText, '')
  assert.equal(result.assetFiles.size, 0)
  assert.match(result.errors[0], /must contain a \.csv file/)
})

test('directory traversal entries are rejected, not extracted', async () => {
  const zip = new JSZip()
  zip.file('questions.csv', 'external_id,question_text\nq-1,hi\n')
  zip.file('assets/../../../etc/passwd', 'malicious')
  zip.file('assets/legit.svg', '<svg></svg>')
  const buffer = await zip.generateAsync({ type: 'nodebuffer' })

  const result = await parseImportPackage({ zipBuffer: buffer })
  assert.equal(result.assetFiles.size, 1)
  assert.ok(result.assetFiles.has('legit.svg'))
  assert.ok(![...result.assetFiles.keys()].some((key) => key.includes('..')))
})

test('absolute-path entries are rejected', async () => {
  const zip = new JSZip()
  zip.file('questions.csv', 'a,b\n1,2\n')
  // JSZip strips a leading slash when adding, so force an entry name that still starts with one.
  zip.file('/assets/absolute.svg', '<svg></svg>')
  const buffer = await zip.generateAsync({ type: 'nodebuffer' })

  const result = await parseImportPackage({ zipBuffer: buffer })
  // Either rejected outright, or normalised safely — never stored under a leading-slash path.
  assert.ok(![...result.assetFiles.keys()].some((key) => key.startsWith('/')))
})

test('duplicate filenames within a zip (case-insensitive) are flagged', async () => {
  const zip = new JSZip()
  zip.file('assets/Diagram.svg', '<svg>first</svg>')
  zip.file('assets/diagram.svg', '<svg>second</svg>')
  const buffer = await zip.generateAsync({ type: 'nodebuffer' })

  const result = await parseImportPackage({ csvText: 'a,b\n1,2\n', extraZipBuffer: buffer })
  assert.equal(result.assetFiles.size, 1)
  assert.ok(result.errors.some((message) => /Duplicate asset filename/.test(message)))
})

test('a package with no manifest still parses (manifest is optional)', async () => {
  const zip = new JSZip()
  zip.file('questions.csv', 'external_id,question_text\nq-1,hi\n')
  zip.file('assets/legit.svg', '<svg xmlns="http://www.w3.org/2000/svg"></svg>')
  const buffer = await zip.generateAsync({ type: 'nodebuffer' })

  const result = await parseImportPackage({ zipBuffer: buffer })
  assert.equal(result.manifest, null)
  assert.deepEqual(result.errors, [])
})

test('a valid manifest.json is parsed and validated without warnings', async () => {
  const svg = '<svg xmlns="http://www.w3.org/2000/svg"></svg>'
  const checksum = createHash('sha256').update(Buffer.from(svg)).digest('hex')
  const zip = new JSZip()
  zip.file('questions.csv', 'external_id,question_text\nq-1,hi\n')
  zip.file('assets/q-1/question.svg', svg)
  zip.file(
    'manifest.json',
    JSON.stringify({
      package_version: '1',
      asset_count: 1,
      assets: [{ external_id: 'q-1', role: 'question', path: 'assets/q-1/question.svg', checksum }],
    })
  )
  const buffer = await zip.generateAsync({ type: 'nodebuffer' })

  const result = await parseImportPackage({ zipBuffer: buffer })
  assert.ok(result.manifest)
  assert.equal(result.manifest?.asset_count, 1)
  assert.deepEqual(result.errors, [])
})

test('a manifest checksum mismatch and count mismatch surface as warnings, not hard failures', async () => {
  const zip = new JSZip()
  zip.file('questions.csv', 'external_id,question_text\nq-1,hi\n')
  zip.file('assets/q-1/question.svg', '<svg xmlns="http://www.w3.org/2000/svg"></svg>')
  zip.file(
    'manifest.json',
    JSON.stringify({
      asset_count: 5,
      assets: [{ path: 'assets/q-1/question.svg', checksum: 'deadbeef' }],
    })
  )
  const buffer = await zip.generateAsync({ type: 'nodebuffer' })

  const result = await parseImportPackage({ zipBuffer: buffer })
  assert.ok(result.manifest)
  assert.equal(result.assetFiles.size, 1) // still importable
  assert.ok(result.errors.some((message) => /checksum for/.test(message)))
  assert.ok(result.errors.some((message) => /declares 5 asset/.test(message)))
})

test('a manifest listing a file absent from the package warns about the missing file', async () => {
  const zip = new JSZip()
  zip.file('questions.csv', 'external_id,question_text\nq-1,hi\n')
  zip.file('manifest.json', JSON.stringify({ assets: [{ path: 'assets/missing.png' }] }))
  const buffer = await zip.generateAsync({ type: 'nodebuffer' })

  const result = await parseImportPackage({ zipBuffer: buffer })
  assert.ok(result.errors.some((message) => /not in the package/.test(message)))
})

test('findUploadedAssetFile matches by bare filename even when the CSV ref is a relative path', async () => {
  const zip = new JSZip()
  zip.file('assets/diagrams/mr-area-001.svg', '<svg></svg>')
  const buffer = await zip.generateAsync({ type: 'nodebuffer' })
  const { assetFiles } = await parseImportPackage({ csvText: 'a\n1\n', extraZipBuffer: buffer })

  assert.ok(findUploadedAssetFile(assetFiles, 'mr-area-001.svg'))
  assert.ok(findUploadedAssetFile(assetFiles, 'MR-AREA-001.SVG'))
  assert.equal(findUploadedAssetFile(assetFiles, 'does-not-exist.svg'), null)
})

test('REGRESSION: repeated basenames across folders resolve to the CORRECT per-folder file', async () => {
  // Mirrors thinking-skills-batch-001: many folders each with question.png / option-a.png /
  // solution.png. The old basename-only lookup collapsed every ref onto the first match, silently
  // linking the wrong image. Every ref must now resolve to the file in its own folder.
  const zip = new JSZip()
  zip.file('questions.csv', 'external_id,question_text\nq-1,hi\n')
  const folders = ['ts-pattern-001', 'ts-pattern-002', 'ts-info-019']
  for (const folder of folders) {
    // Distinct byte content per file so a wrong match is detectable by content.
    zip.file(`assets/${folder}/question.png`, Buffer.from(`Q-${folder}`))
    zip.file(`assets/${folder}/option-a.png`, Buffer.from(`A-${folder}`))
    zip.file(`assets/${folder}/solution.png`, Buffer.from(`S-${folder}`))
  }
  const buffer = await zip.generateAsync({ type: 'nodebuffer' })
  const { assetFiles } = await parseImportPackage({ zipBuffer: buffer })
  assert.equal(assetFiles.size, folders.length * 3)

  for (const folder of folders) {
    for (const [file, tag] of [['question.png', 'Q'], ['option-a.png', 'A'], ['solution.png', 'S']] as const) {
      // Full `assets/…` ref (as it appears in the CSV) …
      const byFullRef = findUploadedAssetFile(assetFiles, `assets/${folder}/${file}`)
      assert.ok(byFullRef, `${folder}/${file} should resolve`)
      assert.equal(byFullRef.buffer.toString(), `${tag}-${folder}`, `${folder}/${file} must be its OWN file`)
      // … and the assets-stripped relative ref resolve to the same file.
      const byRelRef = findUploadedAssetFile(assetFiles, `${folder}/${file}`)
      assert.equal(byRelRef?.relativePath, byFullRef.relativePath)
    }
  }
})

test('an ambiguous bare filename is treated as unresolved, never resolved to an arbitrary file', async () => {
  const zip = new JSZip()
  zip.file('questions.csv', 'external_id,question_text\nq-1,hi\n')
  zip.file('assets/a/option-a.png', Buffer.from('A-a'))
  zip.file('assets/b/option-a.png', Buffer.from('A-b'))
  const buffer = await zip.generateAsync({ type: 'nodebuffer' })
  const { assetFiles } = await parseImportPackage({ zipBuffer: buffer })

  // Bare, ambiguous basename → null (refuse to guess).
  assert.equal(findUploadedAssetFile(assetFiles, 'option-a.png'), null)
  // A fully-qualified ref still resolves each to its own folder file.
  assert.equal(findUploadedAssetFile(assetFiles, 'assets/a/option-a.png')?.buffer.toString(), 'A-a')
  assert.equal(findUploadedAssetFile(assetFiles, 'assets/b/option-a.png')?.buffer.toString(), 'A-b')
})
