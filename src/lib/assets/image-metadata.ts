import { createHash } from 'node:crypto'

/**
 * Pure image-metadata helpers — no `@/` runtime imports, so this stays unit-testable with
 * `node --test`. Reads raster pixel dimensions straight from the file header bytes (no decode,
 * no native deps) and computes a stable content checksum used for dedup + idempotent storage
 * paths. Everything here operates on an in-memory Buffer; nothing touches disk or the network.
 */

export interface ImageDimensions {
  width: number
  height: number
}

/** Lowercase hex SHA-256 of the raw file bytes — the content address used for dedup + paths. */
export function sha256Hex(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex')
}

/** First `length` hex chars of the checksum — embedded in the deterministic storage filename. */
export function checksumPrefix(checksum: string, length = 12): string {
  return checksum.slice(0, length)
}

function readPngDimensions(buffer: Buffer): ImageDimensions | null {
  // PNG: 8-byte signature, then IHDR chunk whose width/height are big-endian u32 at offsets 16/20.
  if (buffer.length < 24) {
    return null
  }
  const width = buffer.readUInt32BE(16)
  const height = buffer.readUInt32BE(20)
  return width > 0 && height > 0 ? { width, height } : null
}

function readJpegDimensions(buffer: Buffer): ImageDimensions | null {
  // JPEG: walk the marker segments until a Start-Of-Frame (SOF0–SOF15, excluding DHT/DRI/etc.),
  // which carries height/width as big-endian u16 right after the 1-byte precision field.
  let offset = 2 // skip the 0xFFD8 SOI marker
  const length = buffer.length
  while (offset + 9 < length) {
    if (buffer[offset] !== 0xff) {
      offset += 1
      continue
    }
    const marker = buffer[offset + 1]
    // Standalone markers (RSTn, SOI, EOI, TEM) carry no length payload.
    if (marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) {
      offset += 2
      continue
    }
    const segmentLength = buffer.readUInt16BE(offset + 2)
    if (segmentLength < 2) {
      return null
    }
    const isBaselineSof = marker >= 0xc0 && marker <= 0xcf
    const isNonSof = marker === 0xc4 || marker === 0xc8 || marker === 0xcc // DHT / JPG / DAC
    if (isBaselineSof && !isNonSof) {
      const height = buffer.readUInt16BE(offset + 5)
      const width = buffer.readUInt16BE(offset + 7)
      return width > 0 && height > 0 ? { width, height } : null
    }
    offset += 2 + segmentLength
  }
  return null
}

function readWebpDimensions(buffer: Buffer): ImageDimensions | null {
  // WEBP has three flavours after the 12-byte RIFF/WEBP header, at a 'VP8 ' / 'VP8L' / 'VP8X' chunk.
  if (buffer.length < 30) {
    return null
  }
  const format = buffer.subarray(12, 16).toString('ascii')

  if (format === 'VP8 ') {
    // Lossy: 3-byte start code at offset 23, then 16-bit width/height (14 low bits each).
    const width = buffer.readUInt16LE(26) & 0x3fff
    const height = buffer.readUInt16LE(28) & 0x3fff
    return width > 0 && height > 0 ? { width, height } : null
  }
  if (format === 'VP8L') {
    // Lossless: after the 0x2f signature byte, 14-bit (width-1) then 14-bit (height-1).
    const bits = buffer.readUInt32LE(21)
    const width = (bits & 0x3fff) + 1
    const height = ((bits >> 14) & 0x3fff) + 1
    return width > 0 && height > 0 ? { width, height } : null
  }
  if (format === 'VP8X') {
    // Extended: 24-bit (width-1) then 24-bit (height-1), little-endian, at offset 24.
    const width = (buffer[24] | (buffer[25] << 8) | (buffer[26] << 16)) + 1
    const height = (buffer[27] | (buffer[28] << 8) | (buffer[29] << 16)) + 1
    return width > 0 && height > 0 ? { width, height } : null
  }
  return null
}

/**
 * Reads pixel dimensions from a raster buffer by sniffing the header, or null when the format is
 * unsupported/unreadable (e.g. SVG, which has no intrinsic pixel size). Never throws — a truncated
 * or malformed header simply yields null so the caller can treat dimensions as "unknown".
 */
export function readImageDimensions(buffer: Buffer): ImageDimensions | null {
  try {
    if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
      return readPngDimensions(buffer)
    }
    if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
      return readJpegDimensions(buffer)
    }
    if (
      buffer.length >= 12 &&
      buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
      buffer.subarray(8, 12).toString('ascii') === 'WEBP'
    ) {
      return readWebpDimensions(buffer)
    }
  } catch {
    return null
  }
  return null
}
