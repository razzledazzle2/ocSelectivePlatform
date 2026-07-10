/**
 * Unit tests for the import asset-package parser: the three supported shapes (CSV alone,
 * CSV + separate assets zip, single zip with a root CSV + assets/ dir), path-traversal
 * rejection, and duplicate-filename detection. In-memory only — never touches disk.
 * Run with: node --test --experimental-strip-types "src/lib/import/*.test.ts" (wired to `npm test`).
 */
import assert from 'node:assert/strict'
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

test('findUploadedAssetFile matches by bare filename even when the CSV ref is a relative path', async () => {
  const zip = new JSZip()
  zip.file('assets/diagrams/mr-area-001.svg', '<svg></svg>')
  const buffer = await zip.generateAsync({ type: 'nodebuffer' })
  const { assetFiles } = await parseImportPackage({ csvText: 'a\n1\n', extraZipBuffer: buffer })

  assert.ok(findUploadedAssetFile(assetFiles, 'mr-area-001.svg'))
  assert.ok(findUploadedAssetFile(assetFiles, 'MR-AREA-001.SVG'))
  assert.equal(findUploadedAssetFile(assetFiles, 'does-not-exist.svg'), null)
})
