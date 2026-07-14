/**
 * Unit tests for the pure image-metadata helpers: header-only dimension reading for PNG/JPEG/WEBP,
 * graceful null for unsupported/truncated input, and the content checksum used for dedup + stable
 * storage paths. Minimal valid headers are synthesised in-memory (no real image files needed).
 * Run with: node --test --experimental-strip-types "src/lib/assets/*.test.ts".
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { checksumPrefix, readImageDimensions, sha256Hex } from './image-metadata.ts'

function makePng(width: number, height: number): Buffer {
  const b = Buffer.alloc(24)
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(b, 0)
  b.writeUInt32BE(13, 8) // IHDR length
  b.write('IHDR', 12, 'ascii')
  b.writeUInt32BE(width, 16)
  b.writeUInt32BE(height, 20)
  return b
}

function makeJpeg(width: number, height: number): Buffer {
  const b = Buffer.alloc(20)
  b[0] = 0xff
  b[1] = 0xd8 // SOI
  b[2] = 0xff
  b[3] = 0xc0 // SOF0
  b.writeUInt16BE(17, 4) // segment length
  b[6] = 8 // precision
  b.writeUInt16BE(height, 7)
  b.writeUInt16BE(width, 9)
  return b
}

function makeWebpVp8x(width: number, height: number): Buffer {
  const b = Buffer.alloc(30)
  b.write('RIFF', 0, 'ascii')
  b.write('WEBP', 8, 'ascii')
  b.write('VP8X', 12, 'ascii')
  const w = width - 1
  const h = height - 1
  b[24] = w & 0xff
  b[25] = (w >> 8) & 0xff
  b[26] = (w >> 16) & 0xff
  b[27] = h & 0xff
  b[28] = (h >> 8) & 0xff
  b[29] = (h >> 16) & 0xff
  return b
}

test('reads PNG dimensions from the IHDR header', () => {
  assert.deepEqual(readImageDimensions(makePng(640, 480)), { width: 640, height: 480 })
})

test('reads JPEG dimensions from the SOF0 marker', () => {
  assert.deepEqual(readImageDimensions(makeJpeg(1024, 768)), { width: 1024, height: 768 })
})

test('reads extended (VP8X) WEBP canvas dimensions', () => {
  assert.deepEqual(readImageDimensions(makeWebpVp8x(300, 200)), { width: 300, height: 200 })
})

test('returns null for SVG/text (no intrinsic pixel size)', () => {
  assert.equal(readImageDimensions(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>')), null)
})

test('returns null for a truncated header instead of throwing', () => {
  assert.equal(readImageDimensions(Buffer.from([0x89, 0x50, 0x4e, 0x47])), null)
})

test('sha256Hex is deterministic and content-addressed', () => {
  const a = Buffer.from('the same bytes')
  const b = Buffer.from('the same bytes')
  const c = Buffer.from('different bytes')
  assert.equal(sha256Hex(a), sha256Hex(b))
  assert.notEqual(sha256Hex(a), sha256Hex(c))
  assert.match(sha256Hex(a), /^[0-9a-f]{64}$/)
})

test('duplicate image detection: identical bytes share a checksum, distinct bytes do not', () => {
  const original = makePng(100, 100)
  const identicalCopy = makePng(100, 100)
  const different = makePng(101, 100)
  assert.equal(sha256Hex(original), sha256Hex(identicalCopy)) // → deduped/reused on import
  assert.notEqual(sha256Hex(original), sha256Hex(different))
})

test('checksumPrefix takes a stable leading slice for the storage filename', () => {
  const checksum = sha256Hex(Buffer.from('abc'))
  assert.equal(checksumPrefix(checksum), checksum.slice(0, 12))
  assert.equal(checksumPrefix(checksum, 8), checksum.slice(0, 8))
})
