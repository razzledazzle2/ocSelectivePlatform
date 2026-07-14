/**
 * Integration test over the sample question package (docs/fixtures/question-pack-sample/): assembles
 * a ZIP from the committed loose fixture files and asserts the parser splits the CSV from the assets
 * and resolves every referenced image — the text-only row, the question diagram, the four image
 * options, the stimulus image and the solution image. Also checks the optional-manifest path.
 * Run with: node --test --experimental-strip-types "src/lib/import/*.test.ts".
 */
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { test } from 'node:test'

import JSZip from 'jszip'

import { findUploadedAssetFile, parseImportPackage } from './asset-package.ts'

const FIXTURE_DIR = path.resolve(import.meta.dirname, '../../../docs/fixtures/question-pack-sample')

async function walk(dir: string, base: string = dir): Promise<Array<{ rel: string; full: string }>> {
  const entries = await fs.readdir(dir, { withFileTypes: true })
  const files: Array<{ rel: string; full: string }> = []
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

async function buildFixtureZip(withManifest: boolean): Promise<Buffer> {
  const files = await walk(FIXTURE_DIR)
  const zip = new JSZip()
  const assets: Array<{ path: string; checksum: string }> = []
  for (const file of files) {
    const buffer = await fs.readFile(file.full)
    zip.file(file.rel, buffer)
    if (file.rel.startsWith('assets/')) {
      assets.push({ path: file.rel, checksum: createHash('sha256').update(buffer).digest('hex') })
    }
  }
  if (withManifest) {
    zip.file('manifest.json', JSON.stringify({ asset_count: assets.length, assets }))
  }
  return zip.generateAsync({ type: 'nodebuffer' })
}

test('sample package: CSV splits from assets and every referenced image resolves', async () => {
  const result = await parseImportPackage({ zipBuffer: await buildFixtureZip(false) })

  // 5 questions (6 CSV lines incl. header) and 7 asset files, no manifest.
  assert.equal(result.csvText.trim().split('\n').length, 6)
  assert.equal(result.assetFiles.size, 7)
  assert.equal(result.manifest, null)
  assert.deepEqual(result.errors, [])

  // Question diagram, four options, stimulus, solution all resolvable by their CSV refs.
  assert.ok(findUploadedAssetFile(result.assetFiles, 'assets/mr-geometry-001/question.svg'))
  for (const label of ['a', 'b', 'c', 'd']) {
    assert.ok(findUploadedAssetFile(result.assetFiles, `assets/ts-spatial-004/option-${label}.svg`), `option ${label}`)
  }
  assert.ok(findUploadedAssetFile(result.assetFiles, 'assets/rd-owl-003/stimulus.svg'))
  assert.ok(findUploadedAssetFile(result.assetFiles, 'assets/mr-solution-005/solution.svg'))
})

test('sample package with a correct manifest.json parses with no warnings', async () => {
  const result = await parseImportPackage({ zipBuffer: await buildFixtureZip(true) })
  assert.ok(result.manifest)
  assert.equal(result.manifest?.asset_count, 7)
  assert.deepEqual(result.errors, [])
})
