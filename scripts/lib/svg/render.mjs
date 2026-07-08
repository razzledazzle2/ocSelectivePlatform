// Central dispatcher: an asset spec ({ type, ... }) in, an SVG string out.
//
// Implemented types render deterministically. Types that are declared in the
// pipeline but not yet built throw a clear, catchable error so the generator
// reports them as "not yet implemented" rather than emitting a wrong diagram.

import { renderCoordinateGrid } from './coordinate-grid.mjs'
import { renderBarChart } from './bar-chart.mjs'
import { renderLineChart } from './line-chart.mjs'
import { renderPieChart } from './pie-chart.mjs'
import { renderGeometryPolygon } from './geometry-polygon.mjs'
import { renderAbstractShapeSequence } from './abstract-shape-sequence.mjs'
import { renderMatrixPattern } from './matrix-pattern.mjs'
import { renderIsometricCubeStack } from './isometric-cubes.mjs'
import { renderSymbolKey } from './symbol-key.mjs'
import { renderShapeAnalogy } from './shape-analogy.mjs'
import { renderFigureTransform } from './figure-transform.mjs'
import { renderPaperFolding } from './paper-folding.mjs'
import { renderIsometric3dViews } from './isometric-3d-views.mjs'
import { renderSpatialAssembly } from './spatial-assembly.mjs'

/** Spec types the pipeline knows about (implemented + planned). */
export const KNOWN_ASSET_TYPES = [
  'coordinate_grid',
  'geometry_polygon',
  'translation_arrow',
  'bar_chart',
  'line_chart',
  'pie_chart',
  'simple_table_visual',
  'abstract_shape_sequence',
  'matrix_pattern',
  'venn_diagram_basic',
  'logic_grid_table',
  // Recognised-but-pending complex types (no generator yet; specs stay pending).
  'isometric_cube_stack',
  'shape_analogy',
  'symbol_key',
  'rotation',
  'reflection',
  'paper_folding',
  'isometric_3d_views',
  'spatial_assembly',
  'scene_illustration',
]

/** Types with a working generator today. The rest are recognised but pending. */
export const IMPLEMENTED_ASSET_TYPES = [
  'coordinate_grid',
  'geometry_polygon',
  'translation_arrow',
  'bar_chart',
  'line_chart',
  'pie_chart',
  'abstract_shape_sequence',
  'matrix_pattern',
  'isometric_cube_stack',
  'symbol_key',
  'shape_analogy',
  'rotation',
  'reflection',
  'paper_folding',
  'isometric_3d_views',
  'spatial_assembly',
]

class NotImplementedError extends Error {
  constructor(type) {
    super(`Asset type "${type}" is recognised but its generator is not implemented yet.`)
    this.name = 'NotImplementedError'
    this.notImplemented = true
  }
}

/** Wraps a bare polygon/arrow spec into a coordinate_grid so it reuses that renderer. */
function asCoordinateGrid(spec, shapeType) {
  if (spec.type === 'coordinate_grid') return spec
  const { type, shapes, width, height, x_min, x_max, y_min, y_max, title, ...shape } = spec
  return {
    type: 'coordinate_grid',
    width,
    height,
    x_min: x_min ?? 0,
    x_max: x_max ?? 10,
    y_min: y_min ?? 0,
    y_max: y_max ?? 10,
    title,
    shapes: shapes ?? [{ type: shapeType, ...shape }],
  }
}

export function renderAssetSpec(spec) {
  if (!spec || typeof spec !== 'object' || typeof spec.type !== 'string') {
    throw new Error('Asset spec must be an object with a string "type".')
  }

  switch (spec.type) {
    case 'coordinate_grid':
      return renderCoordinateGrid(spec)
    case 'geometry_polygon':
      // Grid form (has `shapes`) vs standalone labelled-sides form (has `points`).
      return spec.shapes
        ? renderCoordinateGrid(asCoordinateGrid(spec, 'polygon'))
        : renderGeometryPolygon(spec)
    case 'translation_arrow':
      return renderCoordinateGrid(asCoordinateGrid(spec, 'translation_arrow'))
    case 'bar_chart':
      return renderBarChart(spec)
    case 'line_chart':
      return renderLineChart(spec)
    case 'pie_chart':
      return renderPieChart(spec)
    case 'abstract_shape_sequence':
      return renderAbstractShapeSequence(spec)
    case 'matrix_pattern':
      return renderMatrixPattern(spec)
    case 'isometric_cube_stack':
      return renderIsometricCubeStack(spec)
    case 'symbol_key':
      return renderSymbolKey(spec)
    case 'shape_analogy':
      return renderShapeAnalogy(spec)
    case 'rotation':
    case 'reflection':
      return renderFigureTransform(spec)
    case 'paper_folding':
      return renderPaperFolding(spec)
    case 'isometric_3d_views':
      return renderIsometric3dViews(spec)
    case 'spatial_assembly':
      return renderSpatialAssembly(spec)
    case 'simple_table_visual':
    case 'venn_diagram_basic':
    case 'logic_grid_table':
    case 'scene_illustration':
      throw new NotImplementedError(spec.type)
    default:
      throw new Error(`Unknown asset spec type "${spec.type}".`)
  }
}
