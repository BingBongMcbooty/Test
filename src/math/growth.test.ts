import { describe, expect, it } from 'vitest'
import { STAGE_SHAPE_COUNTS } from '../state/stageConfig'
import {
  GROWTH_EDGE_COUNT,
  GROWTH_MAX_CORNER,
  boxWireframeEdges,
  easeGrowth,
  lerpCorner,
} from './growth'

function edgeLength([a, b]: readonly [readonly number[], readonly number[]]): number {
  return Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2])
}

// When a `max` component is zero, several of `boxWireframeEdges`' 12 named corners
// coincide (e.g. at `max=(3,3,0)` the whole "top face" sits exactly on top of the
// "bottom face"), which duplicates real (non-zero-length) segments rather than
// zeroing them out — harmless for rendering (two coincident lines just overdraw each
// other) but something a test asserting on distinct *segment* counts has to collapse
// first. Canonicalizes each edge (rounded, endpoint order normalized) to a string key
// so duplicate segments count once.
function dedupeEdges(
  edges: readonly (readonly [readonly number[], readonly number[]])[],
): readonly (readonly [readonly number[], readonly number[]])[] {
  const seen = new Map<string, readonly [readonly number[], readonly number[]]>()
  for (const edge of edges) {
    const round = (p: readonly number[]) => p.map((n) => Math.round(n * 1e6) / 1e6)
    const [a, b] = [round(edge[0]), round(edge[1])]
    const key = [a, b].sort((p, q) => p.join(',').localeCompare(q.join(','))).map((p) => p.join(','))
      .join('|')
    if (!seen.has(key)) seen.set(key, edge)
  }
  return [...seen.values()]
}

describe('lerpCorner', () => {
  it('returns the start corner unchanged at t=0', () => {
    expect(lerpCorner([1, 2, 3], [4, 5, 6], 0)).toEqual([1, 2, 3])
  })

  it('returns the end corner unchanged at t=1', () => {
    expect(lerpCorner([1, 2, 3], [4, 5, 6], 1)).toEqual([4, 5, 6])
  })

  it('interpolates componentwise at intermediate t', () => {
    expect(lerpCorner([0, 0, 0], [2, 4, 6], 0.5)).toEqual([1, 2, 3])
  })

  it('interpolates each of the two real growth transitions', () => {
    const lineToPlane = lerpCorner(GROWTH_MAX_CORNER.line, GROWTH_MAX_CORNER.plane, 0.5)
    expect(lineToPlane).toEqual([3, 1.5, 0])

    const planeToCube = lerpCorner(GROWTH_MAX_CORNER.plane, GROWTH_MAX_CORNER.cube, 0.5)
    expect(planeToCube).toEqual([2.75, 2.75, 1.25])
  })
})

describe('easeGrowth', () => {
  it('maps 0 to 0 and 1 to 1', () => {
    expect(easeGrowth(0)).toBe(0)
    expect(easeGrowth(1)).toBe(1)
  })

  it('clamps out-of-range input rather than overshooting', () => {
    expect(easeGrowth(-1)).toBe(0)
    expect(easeGrowth(2)).toBe(1)
  })

  it('sits exactly at the midpoint at t=0.5, unlike a front-loaded ease-out', () => {
    expect(easeGrowth(0.5)).toBeCloseTo(0.5, 10)
  })

  it('starts and ends slow (below/above the linear rate near each edge) and is symmetric', () => {
    expect(easeGrowth(0.1)).toBeLessThan(0.1) // slow start: behind a linear ramp early on
    expect(easeGrowth(0.9)).toBeGreaterThan(0.9) // slow finish: ahead of a linear ramp late on
    expect(easeGrowth(0.3) + easeGrowth(0.7)).toBeCloseTo(1, 10) // symmetric around the midpoint
  })
})

describe('boxWireframeEdges', () => {
  it('always returns exactly GROWTH_EDGE_COUNT edges, degenerate or not', () => {
    expect(boxWireframeEdges([0, 0, 0])).toHaveLength(GROWTH_EDGE_COUNT)
    expect(boxWireframeEdges(GROWTH_MAX_CORNER.line)).toHaveLength(GROWTH_EDGE_COUNT)
    expect(boxWireframeEdges(GROWTH_MAX_CORNER.plane)).toHaveLength(GROWTH_EDGE_COUNT)
    expect(boxWireframeEdges(GROWTH_MAX_CORNER.cube)).toHaveLength(GROWTH_EDGE_COUNT)
  })

  it("at the line's own max corner, degenerates to exactly Stage 1's single edge", () => {
    const realEdges = dedupeEdges(
      boxWireframeEdges(GROWTH_MAX_CORNER.line).filter((edge) => edgeLength(edge) > 1e-9),
    )
    expect(realEdges).toHaveLength(STAGE_SHAPE_COUNTS.line!.edges)
    expect(realEdges[0]).toEqual([
      [0, 0, 0],
      [3, 0, 0],
    ])
  })

  it("at the plane's own max corner, degenerates to exactly Stage 2's 4-edge square outline", () => {
    const realEdges = dedupeEdges(
      boxWireframeEdges(GROWTH_MAX_CORNER.plane).filter((edge) => edgeLength(edge) > 1e-9),
    )
    expect(realEdges).toHaveLength(STAGE_SHAPE_COUNTS.plane!.edges)
    // Every real edge should run exactly along the plane's own 3-unit sides.
    for (const edge of realEdges) expect(edgeLength(edge)).toBeCloseTo(3, 10)
  })

  it("at the cube's own max corner, is a full 12-edge cube matching Stage 3's edge count", () => {
    const edges = boxWireframeEdges(GROWTH_MAX_CORNER.cube)
    expect(edges.every((edge) => edgeLength(edge) > 1e-9)).toBe(true)
    expect(edges).toHaveLength(STAGE_SHAPE_COUNTS.cube!.edges)
    for (const edge of edges) expect(edgeLength(edge)).toBeCloseTo(2.5, 10)
  })

  it('at a zero corner (t=0 of a line->plane transition), every edge is degenerate', () => {
    const edges = boxWireframeEdges([0, 0, 0])
    expect(edges.every((edge) => edgeLength(edge) === 0)).toBe(true)
  })
})
