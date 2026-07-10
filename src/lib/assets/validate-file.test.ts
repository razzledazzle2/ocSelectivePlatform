/**
 * Unit tests for asset file validation/sanitisation: extension allowlist, magic-byte sniffing
 * (rejects a mismatched claimed-vs-actual type), size caps, and SVG script/handler stripping.
 * Run with: node --test --experimental-strip-types "src/lib/assets/*.test.ts" (wired to `npm test`).
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { MAX_RASTER_BYTES, MAX_SVG_BYTES, validateAssetFile } from './validate-file.ts'

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
const JPEG_SIGNATURE = Buffer.from([0xff, 0xd8, 0xff, 0xe0])

test('rejects an unsupported extension outright', () => {
  const result = validateAssetFile({ filename: 'diagram.exe', size: 10, buffer: Buffer.from('MZ') })
  assert.equal(result.ok, false)
  assert.match(result.reason, /Unsupported file type/)
})

test('rejects a file whose content does not match its extension (disguised upload)', () => {
  // A PNG's magic bytes wrapped in a filename claiming to be an SVG.
  const buffer = Buffer.concat([PNG_SIGNATURE, Buffer.from('junk')])
  const result = validateAssetFile({ filename: 'fake.svg', size: buffer.length, buffer })
  assert.equal(result.ok, false)
  assert.match(result.reason, /does not match its/)
})

test('accepts a genuine PNG', () => {
  const buffer = Buffer.concat([PNG_SIGNATURE, Buffer.from('rest-of-file')])
  const result = validateAssetFile({ filename: 'diagram.png', size: buffer.length, buffer })
  assert.equal(result.ok, true)
  assert.equal(result.assetType, 'image')
  assert.equal(result.mimeType, 'image/png')
})

test('accepts a genuine JPEG under the .jpg extension', () => {
  const buffer = Buffer.concat([JPEG_SIGNATURE, Buffer.from('rest-of-file')])
  const result = validateAssetFile({ filename: 'diagram.jpg', size: buffer.length, buffer })
  assert.equal(result.ok, true)
  assert.equal(result.mimeType, 'image/jpeg')
})

test('rejects a raster file over the size cap', () => {
  const buffer = Buffer.concat([PNG_SIGNATURE, Buffer.alloc(MAX_RASTER_BYTES)])
  const result = validateAssetFile({ filename: 'huge.png', size: buffer.length, buffer })
  assert.equal(result.ok, false)
  assert.match(result.reason, /too large/)
})

test('rejects an SVG over the (much smaller) size cap', () => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg">${'x'.repeat(MAX_SVG_BYTES)}</svg>`
  const buffer = Buffer.from(svg, 'utf8')
  const result = validateAssetFile({ filename: 'huge.svg', size: buffer.length, buffer })
  assert.equal(result.ok, false)
  assert.match(result.reason, /too large/)
})

test('strips a <script> tag from an uploaded SVG', () => {
  const svg = '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(document.cookie)</script><circle r="5"/></svg>'
  const buffer = Buffer.from(svg, 'utf8')
  const result = validateAssetFile({ filename: 'malicious.svg', size: buffer.length, buffer })
  assert.equal(result.ok, true)
  const sanitized = result.sanitizedBuffer.toString('utf8')
  assert.doesNotMatch(sanitized, /<script/i)
  assert.doesNotMatch(sanitized, /alert/i)
  assert.match(sanitized, /<circle/i)
})

test('strips onload/onerror event-handler attributes from an uploaded SVG', () => {
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"><rect onerror="alert(2)" width="1" height="1"/></svg>'
  const buffer = Buffer.from(svg, 'utf8')
  const result = validateAssetFile({ filename: 'malicious.svg', size: buffer.length, buffer })
  assert.equal(result.ok, true)
  const sanitized = result.sanitizedBuffer.toString('utf8')
  assert.doesNotMatch(sanitized, /onload/i)
  assert.doesNotMatch(sanitized, /onerror/i)
})

test('strips a javascript: URI from an SVG anchor href', () => {
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg"><a href="javascript:alert(1)"><rect width="1" height="1"/></a></svg>'
  const buffer = Buffer.from(svg, 'utf8')
  const result = validateAssetFile({ filename: 'malicious.svg', size: buffer.length, buffer })
  assert.equal(result.ok, true)
  const sanitized = result.sanitizedBuffer.toString('utf8')
  assert.doesNotMatch(sanitized, /javascript:/i)
})

test('strips a <foreignObject> (a common SVG script-smuggling vector)', () => {
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg"><foreignObject><script xmlns="http://www.w3.org/1999/xhtml">alert(1)</script></foreignObject></svg>'
  const buffer = Buffer.from(svg, 'utf8')
  const result = validateAssetFile({ filename: 'malicious.svg', size: buffer.length, buffer })
  assert.equal(result.ok, true)
  const sanitized = result.sanitizedBuffer.toString('utf8')
  assert.doesNotMatch(sanitized, /foreignObject/i)
  assert.doesNotMatch(sanitized, /script/i)
})

test('a clean SVG survives sanitisation intact', () => {
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><circle cx="5" cy="5" r="4"/></svg>'
  const buffer = Buffer.from(svg, 'utf8')
  const result = validateAssetFile({ filename: 'clean.svg', size: buffer.length, buffer })
  assert.equal(result.ok, true)
  assert.equal(result.assetType, 'svg')
  const sanitized = result.sanitizedBuffer.toString('utf8')
  assert.match(sanitized, /<circle/i)
})
