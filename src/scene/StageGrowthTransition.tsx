import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { BufferAttribute, BufferGeometry } from 'three'
import {
  GROWTH_DURATION,
  GROWTH_EDGE_COUNT,
  GROWTH_MAX_CORNER,
  GROWTH_MAX_FRAME_DELTA,
  boxWireframeEdges,
  easeGrowth,
  lerpCorner,
} from '../math/growth'
import { useDimensionsStore } from '../state/store'

// Module-scope, not `useMemo`/`useRef` — this component is only ever mounted once
// (`Experience.tsx`), so a single shared, persistently-mutated geometry works exactly
// like `TrackedCubeVertexTracker.tsx`'s `markerGeometry` / `ArrowDrag.tsx`'s collider
// geometries: a plain module constant, never rebuilt. Being a plain JS value (not a
// hook return) also sidesteps two different `eslint-plugin-react-hooks` checks a
// per-instance version hit — mutating a `useMemo`-held object from `useFrame` (the
// pattern `scene/materials.ts`'s `withTimeUniform` doc comment already describes
// working around, for a different reason) and reading a `useRef`'s `.current` during
// render (its `react-hooks/refs` rule flags that even for the "lazy-init a ref" idiom
// React's own docs recommend). A fixed-size position buffer (`GROWTH_EDGE_COUNT` edges,
// 2 points each) is allocated once and every frame's `boxWireframeEdges` output is
// written into it in place via `BufferAttribute.setXYZ`, rather than swapping in a
// fresh `BufferGeometry` — unlike `RevealStage.tsx`'s per-render-state geometry rebuild,
// this needs to update on every single animation frame for `GROWTH_DURATION` seconds,
// where rebuilding+disposing a `BufferGeometry` ~30-60 times per transition would be
// wasteful for no benefit over mutating one in place.
const growthGeometry = new BufferGeometry()
growthGeometry.setAttribute(
  'position',
  new BufferAttribute(new Float32Array(GROWTH_EDGE_COUNT * 2 * 3), 3),
)

/**
 * Task 25: plays the Stage 1->2 / 2->3 growth animation — the existing shape visibly
 * extending into the next stage's shape (the line sweeping out a perpendicular edge to
 * become the plane's outline; the plane extruding along the newly-available axis, and
 * settling to the cube's slightly smaller footprint, to become the cube) — in place of
 * the destination stage's normal static geometry for `GROWTH_DURATION` seconds, driven
 * entirely by `math/growth.ts`'s shared box-wireframe interpolation. Always mounted
 * (see `Experience.tsx`), renders nothing when `growthTransition` is null (the common
 * case: every stage change *except* a real player-driven line->plane or plane->cube
 * advance — see `state/store.ts`'s `advanceStage`).
 *
 * `scene/Experience.tsx`'s `StageGeometry` is the other half of this: it suppresses
 * the destination stage's own normal component for exactly as long as this one is
 * rendering, so the two never show at once (which would either double the outline or,
 * worse, let the finished shape appear instantly on frame one — defeating the point of
 * watching it grow).
 */
export function StageGrowthTransition() {
  const growthTransition = useDimensionsStore((state) => state.growthTransition)
  const finishGrowthTransition = useDimensionsStore((state) => state.finishGrowthTransition)
  const elapsedRef = useRef(0)

  // A fresh growth transition (a new `{ from, to }` object identity, set once per
  // advance) restarts the animation clock from zero.
  useEffect(() => {
    elapsedRef.current = 0
  }, [growthTransition])

  useFrame((_, delta) => {
    if (!growthTransition) return

    elapsedRef.current += Math.min(delta, GROWTH_MAX_FRAME_DELTA)
    const t = easeGrowth(elapsedRef.current / GROWTH_DURATION)
    const maxCorner = lerpCorner(
      GROWTH_MAX_CORNER[growthTransition.from as 'line' | 'plane'],
      GROWTH_MAX_CORNER[growthTransition.to as 'plane' | 'cube'],
      t,
    )
    const edges = boxWireframeEdges(maxCorner)
    const positions = growthGeometry.attributes.position as BufferAttribute
    edges.forEach(([a, b], i) => {
      positions.setXYZ(i * 2, a[0], a[1], a[2])
      positions.setXYZ(i * 2 + 1, b[0], b[1], b[2])
    })
    positions.needsUpdate = true

    if (elapsedRef.current >= GROWTH_DURATION) finishGrowthTransition()
  })

  if (!growthTransition) return null

  return (
    <lineSegments geometry={growthGeometry}>
      <lineBasicMaterial color="#e5e4e7" />
    </lineSegments>
  )
}
