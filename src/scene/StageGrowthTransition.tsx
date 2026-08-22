import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { BufferAttribute, BufferGeometry, Color, type LineBasicMaterial } from 'three'
import {
  GROWTH_DURATION,
  GROWTH_EDGE_COUNT,
  GROWTH_FLASH_COLOR,
  GROWTH_MAX_FRAME_DELTA,
  GROWTH_REST_COLOR,
  boxWireframeEdges,
  easeGrowthFlashy,
  growthFlashIntensity,
  lerpCorner,
  signedGrowthMaxCorner,
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

// Scratch `Color`s, reused every frame rather than allocated fresh — `restColor.lerp`
// below mutates a copy of this, never these originals.
const restColor = new Color(GROWTH_REST_COLOR)
const flashColor = new Color(GROWTH_FLASH_COLOR)

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
 * Post-launch playtest feedback ("not seamless enough… they should feel flashy") added
 * two things on top of Task 25's original plain-smoothstep version: the box corner now
 * interpolates on `easeGrowthFlashy`'s overshoot-and-spring-back curve instead of a
 * purely monotonic glide, and the wireframe's own color pulses toward a bright accent
 * (`GROWTH_FLASH_COLOR`) and back via `growthFlashIntensity`, both driven off the same
 * per-frame progress rather than a second independent animation clock.
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
  const axisSign = useDimensionsStore((state) => state.axisSign)
  const elapsedRef = useRef(0)
  const materialRef = useRef<LineBasicMaterial>(null)

  // A fresh growth transition (a new `{ from, to }` object identity, set once per
  // advance) restarts the animation clock from zero.
  useEffect(() => {
    elapsedRef.current = 0
  }, [growthTransition])

  useFrame((_, delta) => {
    if (!growthTransition) return

    elapsedRef.current += Math.min(delta, GROWTH_MAX_FRAME_DELTA)
    // Linear (unclamped-overshoot) progress drives the finish check and the color-flash
    // curve, which is only meaningful over [0, 1]; the geometry itself uses the
    // overshoot-eased value, which can briefly exceed 1.
    const rawT = Math.min(1, elapsedRef.current / GROWTH_DURATION)
    const poppedT = easeGrowthFlashy(rawT)
    // Post-Task-25: both ends signed by the *same* current axisSign — the 'from'
    // corner needs it too (not just 'to'), since e.g. the plane->cube transition's
    // 'from' corner is the plane's own already-mirrored y, and interpolating from an
    // unsigned start would jump right at the animation's first frame instead of
    // continuing smoothly from wherever the real, just-suppressed PlaneStage actually
    // was (see ArrowDrag.tsx's `discoveredAxisSign`/store's `recordAxisDiscovery`).
    const maxCorner = lerpCorner(
      signedGrowthMaxCorner(growthTransition.from as 'line' | 'plane', axisSign),
      signedGrowthMaxCorner(growthTransition.to as 'plane' | 'cube', axisSign),
      poppedT,
    )
    const edges = boxWireframeEdges(maxCorner)
    const positions = growthGeometry.attributes.position as BufferAttribute
    edges.forEach(([a, b], i) => {
      positions.setXYZ(i * 2, a[0], a[1], a[2])
      positions.setXYZ(i * 2 + 1, b[0], b[1], b[2])
    })
    positions.needsUpdate = true

    const material = materialRef.current
    if (material) material.color.copy(restColor).lerp(flashColor, growthFlashIntensity(rawT))

    if (elapsedRef.current >= GROWTH_DURATION) finishGrowthTransition()
  })

  if (!growthTransition) return null

  return (
    <lineSegments geometry={growthGeometry}>
      <lineBasicMaterial ref={materialRef} color={GROWTH_REST_COLOR} />
    </lineSegments>
  )
}
