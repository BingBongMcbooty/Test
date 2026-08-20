import { useEffect, useMemo } from 'react'
import { BufferGeometry, Float32BufferAttribute, SphereGeometry } from 'three'
import {
  TESSERACT_EDGES,
  TESSERACT_FACES,
  TESSERACT_VERTICES,
  type Point3,
  applyRevealRotation,
  projectTo3D,
  sliceTesseract,
} from '../../math/fourd'
import { useDimensionsStore } from '../../state/store'
import { useTesseractLineMaterial } from '../materials'
import { TRACKED_VERTEX_COLOR, TRACKED_VERTEX_INDEX } from '../trackedVertex'

/**
 * Visual scale applied to `math/fourd.ts`'s unit (+-1) tesseract coordinates, tuned by
 * eye against the cube stage's own size (`CubeStage`'s `BoxGeometry` half-extent 1.25).
 */
const TESSERACT_SCALE = 1.3

function segmentsToPositions(segments: readonly (readonly [Point3, Point3])[]): Float32Array {
  const positions = new Float32Array(segments.length * 6)
  segments.forEach(([a, b], i) => {
    positions[i * 6 + 0] = a.x * TESSERACT_SCALE
    positions[i * 6 + 1] = a.y * TESSERACT_SCALE
    positions[i * 6 + 2] = a.z * TESSERACT_SCALE
    positions[i * 6 + 3] = b.x * TESSERACT_SCALE
    positions[i * 6 + 4] = b.y * TESSERACT_SCALE
    positions[i * 6 + 5] = b.z * TESSERACT_SCALE
  })
  return positions
}

// Task 19: a small fixed-size marker highlighting `TRACKED_VERTEX_INDEX`'s current
// position, in the same color as its `DimensionPanel` readout row — module-scope and
// reused across renders, same "cheap shared geometry" pattern as `RevealDrag.tsx`'s
// collider sphere.
const trackedVertexGeometry = new SphereGeometry(0.07, 16, 16)

/**
 * Stage 4: the tesseract from `math/fourd.ts` (Task 13), rendered as `THREE.LineSegments`
 * in one of two views — 'slice' (the w=w0 hyperplane cross-section) or 'projection' (the
 * whole shape's perspective 4D->3D shadow) — both read from the same store-held
 * `revealRotationXW`/`revealRotationYW`/`revealSliceW0` (see `RevealDrag.tsx`, the
 * player-driven controller for that state) rather than autoplaying on a timer.
 *
 * Both rotation planes are composed in via `applyRevealRotation` (xw then yw) — a single
 * rotation plane isn't enough for the slice view to show real variety: see `rotateYW`'s
 * doc comment in `fourd.ts` for why xw-only rotation always leaves the cross-section as a
 * full-extent box no matter the angle, which is what a real playtest surfaced as
 * "wobbling" rather than genuinely changing shape. `rotateYZ` is still never driven —
 * see `RevealDrag.tsx`'s doc comment for why that one's redundant with camera orbit.
 *
 * A fresh `BufferGeometry` is built on every relevant state change rather than mutating
 * one in place — the slice view's vertex count varies frame to frame (0 to 24 points
 * depending on rotation/offset), and mutating a memoized three.js object outside its own
 * `useMemo` factory is the same compiler-flagged pattern `materials.ts`/`ArrowDrag.tsx`'s
 * notes describe working around elsewhere in this codebase. Explicitly disposed on
 * cleanup so a long drag session doesn't leak GPU buffers.
 *
 * Task 19 adds a highlighted marker at `TRACKED_VERTEX_INDEX`'s live position — the same
 * point whose x/y/z/w fills `ui/DimensionPanel.tsx`'s ledger, in the same color, so the
 * number and the point read as one thing. It uses the identical `rotated` vertex set the
 * wireframe itself is built from (not a re-derivation), and follows each view's own
 * coordinate treatment: raw x/y/z in slice view (matching `sliceTesseract`'s crossing
 * points, which are never perspective-scaled), `projectTo3D`'s scaled position in
 * projection view (matching every other projected vertex the wireframe draws) — so in
 * projection view the marker sits exactly on one of the shadow's own corners, and in
 * slice view it floats through space at the vertex's real (unsliced) position, only
 * landing on the visible cross-section when its w happens to pass through w0.
 */
export function RevealStage() {
  const revealView = useDimensionsStore((state) => state.revealView)
  const revealRotationXW = useDimensionsStore((state) => state.revealRotationXW)
  const revealRotationYW = useDimensionsStore((state) => state.revealRotationYW)
  const revealSliceW0 = useDimensionsStore((state) => state.revealSliceW0)
  const material = useTesseractLineMaterial()

  const rotated = useMemo(
    () => applyRevealRotation(TESSERACT_VERTICES, revealRotationXW, revealRotationYW),
    [revealRotationXW, revealRotationYW],
  )

  const geometry = useMemo(() => {
    const geo = new BufferGeometry()

    const segments: [Point3, Point3][] =
      revealView === 'slice'
        ? sliceTesseract(rotated, TESSERACT_FACES, revealSliceW0).map((edge) => [edge.a, edge.b])
        : (() => {
            const projected = projectTo3D(rotated)
            return TESSERACT_EDGES.map((edge) => [projected[edge.a], projected[edge.b]])
          })()

    geo.setAttribute('position', new Float32BufferAttribute(segmentsToPositions(segments), 3))
    return geo
  }, [rotated, revealView, revealSliceW0])

  useEffect(() => {
    return () => geometry.dispose()
  }, [geometry])

  const trackedPoint = useMemo(() => {
    const point =
      revealView === 'slice'
        ? {
            x: rotated[TRACKED_VERTEX_INDEX][0],
            y: rotated[TRACKED_VERTEX_INDEX][1],
            z: rotated[TRACKED_VERTEX_INDEX][2],
          }
        : projectTo3D([rotated[TRACKED_VERTEX_INDEX]])[0]
    return [
      point.x * TESSERACT_SCALE,
      point.y * TESSERACT_SCALE,
      point.z * TESSERACT_SCALE,
    ] as const
  }, [rotated, revealView])

  return (
    <>
      <lineSegments geometry={geometry}>
        <primitive object={material} attach="material" />
      </lineSegments>
      <mesh geometry={trackedVertexGeometry} position={trackedPoint}>
        <meshBasicMaterial color={TRACKED_VERTEX_COLOR} />
      </mesh>
    </>
  )
}
