// Type declarations for the pure ESM SVG renderer (render.mjs).
//
// Server-side TypeScript imports this module WITHOUT a file extension
// (`from '.../scripts/lib/svg/render'`) so that:
//   - tsc (classic node resolution) picks up this .d.ts, and
//   - the Next/webpack bundler resolves the real render.mjs at build time.
// Keep these signatures in sync with render.mjs.

/** Spec types the pipeline knows about (implemented + recognised-but-pending). */
export const KNOWN_ASSET_TYPES: string[]

/** Spec types with a working deterministic generator today. */
export const IMPLEMENTED_ASSET_TYPES: string[]

/**
 * Renders a structured asset spec (the inner `{ type, ... }` object) to an SVG
 * string. Throws for unknown types; throws an error with `.notImplemented`
 * true for recognised-but-pending types.
 */
export function renderAssetSpec(spec: Record<string, unknown>): string
