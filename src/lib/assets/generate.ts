// Server-side deterministic asset generation.
//
// Reuses the SAME pure SVG renderer as `npm run generate:assets`
// (scripts/lib/svg/render.mjs) so an in-app "generate" and an offline batch
// run produce byte-identical output. This module never uses AI image
// generation — it only draws supported, deterministic specs.
//
// Server-only: touches the filesystem (writes SVGs under public/) and reads the
// committed spec files. Import it from server actions / mutations / import code,
// never from a client component.

import { promises as fs } from 'node:fs'
import path from 'node:path'

// Extensionless import: tsc resolves scripts/lib/svg/render.d.ts, the bundler
// resolves the real render.mjs. See render.d.ts for why.
import { IMPLEMENTED_ASSET_TYPES, renderAssetSpec } from '../../../scripts/lib/svg/render'

import { PENDING_REF_PREFIX, PUBLIC_ASSET_REF_PREFIX, PUBLIC_ASSET_URL_PREFIX } from '@/lib/assets/refs'
import type { AssetStatus, AssetType } from '@/lib/types'

// Sub-path UNDER the public-asset prefix (which already includes
// `question-assets/`). i.e. the full generated ref is
// `${PUBLIC_ASSET_REF_PREFIX}${GENERATED_SUBDIR}/<base>.svg` →
// `asset://question-assets/generated/<base>.svg`. Do NOT repeat `question-assets`.
const GENERATED_SUBDIR = 'generated'
const PROJECT_ROOT = process.cwd()
const PUBLIC_GENERATED_DIR = path.join(PROJECT_ROOT, 'public', 'question-assets', 'generated')
const SPEC_DIR = path.join(PROJECT_ROOT, 'docs', 'generated-question-bank', 'asset-specs')

/** Spec `type` values we can render deterministically (from the shared renderer). */
export const SUPPORTED_ASSET_SPEC_TYPES: ReadonlySet<string> = new Set(IMPLEMENTED_ASSET_TYPES)

/** Whether a parsed spec object has a `type` this pipeline can render. */
export function isSupportedSpec(spec: unknown): spec is { type: string } {
  return (
    Boolean(spec) &&
    typeof spec === 'object' &&
    typeof (spec as { type?: unknown }).type === 'string' &&
    SUPPORTED_ASSET_SPEC_TYPES.has((spec as { type: string }).type)
  )
}

/** The public ref + on-disk location a pending ref resolves to once generated. */
export interface GeneratedTarget {
  /** basename without extension, e.g. `mr4-pie-sport`. */
  base: string
  /** `asset://question-assets/generated/<base>.svg` */
  generatedRef: string
  /** `/question-assets/generated/<base>.svg` (served URL). */
  publicUrl: string
  /** Absolute path the SVG is written to. */
  filePath: string
}

/**
 * Derives the generated .svg target for a ref. Accepts a pending ref
 * (`asset://pending/<base>.(png|svg)`) or an already-generated ref; either way
 * the output is always the `<base>.svg` under the generated folder.
 */
export function deriveGeneratedTarget(ref: string): GeneratedTarget | null {
  const trimmed = ref.trim()
  const rawName = trimmed.slice(trimmed.lastIndexOf('/') + 1)
  const base = rawName.replace(/\.[a-z0-9]+$/i, '')
  // Only lowercase-slug bases are safe to turn into a filename (matches the spec
  // naming convention and prevents path traversal from a crafted ref).
  if (!base || !/^[a-z0-9-]+$/.test(base)) {
    return null
  }
  return {
    base,
    generatedRef: `${PUBLIC_ASSET_REF_PREFIX}${GENERATED_SUBDIR}/${base}.svg`,
    publicUrl: `${PUBLIC_ASSET_URL_PREFIX}${GENERATED_SUBDIR}/${base}.svg`,
    filePath: path.join(PUBLIC_GENERATED_DIR, `${base}.svg`),
  }
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}

/** Reads all committed spec files once and indexes their inner spec by base name. */
let specFileCache: Map<string, Record<string, unknown>> | null = null
async function loadCommittedSpecs(): Promise<Map<string, Record<string, unknown>>> {
  if (specFileCache) {
    return specFileCache
  }
  const byBase = new Map<string, Record<string, unknown>>()
  try {
    const files = (await fs.readdir(SPEC_DIR)).filter((file) => file.endsWith('.json'))
    for (const file of files) {
      try {
        const entry = JSON.parse(await fs.readFile(path.join(SPEC_DIR, file), 'utf8'))
        const ref: string = entry.asset_ref ?? ''
        const base = ref.slice(ref.lastIndexOf('/') + 1).replace(/\.svg$/, '')
        if (base && entry.spec && typeof entry.spec === 'object') {
          byBase.set(base, entry.spec as Record<string, unknown>)
        }
      } catch {
        // Skip an unreadable/invalid spec file; others still load.
      }
    }
  } catch {
    // Spec directory absent (e.g. trimmed deployment) — fall back to DB specs only.
  }
  specFileCache = byBase
  return byBase
}

/** The committed spec for a base name, if one exists on disk. */
export async function committedSpecForBase(base: string): Promise<Record<string, unknown> | null> {
  return (await loadCommittedSpecs()).get(base) ?? null
}

export interface ResolveAssetGenerationInput {
  /** The asset reference from a CSV cell or an existing assets row. */
  ref: string
  /**
   * A structured spec to use when this ref has no committed spec file. Only pass
   * the row/DB spec that genuinely belongs to THIS asset (e.g. the primary
   * question diagram) — never a question spec for an option image.
   */
  ownSpec?: Record<string, unknown> | null
  /**
   * Force a fresh render even when an SVG already exists on disk (used by
   * "Regenerate"). Requires a supported spec; without one the existing file is
   * kept.
   */
  force?: boolean
}

export interface ResolveAssetGenerationResult {
  /** Whether the asset is (now) backed by a generated SVG on disk. */
  generated: boolean
  /** The ref to store: the generated ref when generated, else the original. */
  ref: string
  /** The served public URL when generated (for assets.external_url), else null. */
  publicUrl: string | null
  /** The asset status to store. */
  status: AssetStatus
  /** Asset type to store (svg once generated). */
  assetType: AssetType | null
  /** The spec that was used / should be persisted for this asset (or null). */
  spec: Record<string, unknown> | null
  /** True when this call wrote a new SVG file (vs. reusing a committed one). */
  wroteFile: boolean
  /** Human-readable reason it stayed pending (only set when not generated). */
  pendingReason?: string
}

/**
 * The single decision point for turning one asset ref into a generated SVG,
 * safely. Order:
 *   1. Not a pending ref → nothing to do (already generated/uploaded/external).
 *   2. A committed SVG already exists for this base → just repoint (no render).
 *   3. A supported spec (this asset's own, or a committed spec file) → render +
 *      write the SVG, then repoint. Marks generated ONLY if the write succeeds.
 *   4. Otherwise → stays pending with a clear reason (unsupported / no spec /
 *      write failed). Never marks generated without a real file.
 */
export async function resolveAssetGeneration(
  input: ResolveAssetGenerationInput
): Promise<ResolveAssetGenerationResult> {
  const ref = input.ref.trim()

  // 1. Candidates are pending placeholders and our own generated public refs
  //    (the latter so regenerate/repair can re-derive the canonical ref + file).
  //    External URLs and storage-bucket paths are never touched here.
  const isCandidate = ref.startsWith(PENDING_REF_PREFIX) || ref.startsWith(PUBLIC_ASSET_REF_PREFIX)
  if (!isCandidate) {
    return {
      generated: false,
      ref,
      publicUrl: null,
      status: 'pending',
      assetType: null,
      spec: input.ownSpec ?? null,
      wroteFile: false,
    }
  }

  const target = deriveGeneratedTarget(ref)
  if (!target) {
    return {
      generated: false,
      ref,
      publicUrl: null,
      status: 'pending',
      assetType: null,
      spec: input.ownSpec ?? null,
      wroteFile: false,
      pendingReason: `Ref "${ref}" has no safe generated filename.`,
    }
  }

  // Prefer the committed per-asset spec (authoritative for that base); fall back
  // to this asset's own spec. This prevents a question spec ever rendering an
  // option image.
  const committed = await committedSpecForBase(target.base)
  const spec = committed ?? input.ownSpec ?? null

  // 2. Reuse an already-committed SVG without re-rendering (unless forcing a
  //    fresh render from a supported spec).
  if (!(input.force && isSupportedSpec(spec)) && (await fileExists(target.filePath))) {
    return {
      generated: true,
      ref: target.generatedRef,
      publicUrl: target.publicUrl,
      status: 'generated',
      assetType: 'svg',
      spec,
      wroteFile: false,
    }
  }

  // 3. Render from a supported spec.
  if (!spec) {
    return {
      generated: false,
      ref,
      publicUrl: null,
      status: 'pending',
      assetType: null,
      spec: null,
      wroteFile: false,
      pendingReason: `No SVG on disk and no spec available for "${target.base}".`,
    }
  }
  if (!isSupportedSpec(spec)) {
    const type = (spec as { type?: unknown }).type
    return {
      generated: false,
      ref,
      publicUrl: null,
      status: 'pending',
      assetType: null,
      spec,
      wroteFile: false,
      pendingReason:
        typeof type === 'string'
          ? `Spec type "${type}" has no deterministic generator — left pending.`
          : 'Spec has no "type" — left pending.',
    }
  }

  try {
    const svg = renderAssetSpec(spec)
    await fs.mkdir(PUBLIC_GENERATED_DIR, { recursive: true })
    await fs.writeFile(target.filePath, `${svg}\n`, 'utf8')
  } catch (error) {
    return {
      generated: false,
      ref,
      publicUrl: null,
      status: 'pending',
      assetType: null,
      spec,
      wroteFile: false,
      pendingReason:
        error instanceof Error ? `Generation failed: ${error.message}` : 'Generation failed — left pending.',
    }
  }

  return {
    generated: true,
    ref: target.generatedRef,
    publicUrl: target.publicUrl,
    status: 'generated',
    assetType: 'svg',
    spec,
    wroteFile: true,
  }
}
