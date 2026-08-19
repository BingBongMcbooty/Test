import { useEffect, useMemo } from 'react'
import { BufferGeometry, Float32BufferAttribute } from 'three'
import {
  TESSERACT_EDGES,
  TESSERACT_FACES,
  TESSERACT_VERTICES,
  type Point3,
  projectTo3D,
  rotateXW,
  rotateYW,
  sliceTesseract,
} from '../../math/fourd'
import { useDimensionsStore } from '../../state/store'
import { useTesseractLineMaterial } from '../materials'

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

/**
 * Stage 4: the tesseract from `math/fourd.ts` (Task 13), rendered as `THREE.LineSegments`
 * in one of two views — 'slice' (the w=w0 hyperplane cross-section) or 'projection' (the
 * whole shape's perspective 4D->3D shadow) — both read from the same store-held
 * `revealRotationXW`/`revealRotationYW`/`revealSliceW0` (see `RevealDrag.tsx`, the
 * player-driven controller for that state) rather than autoplaying on a timer.
 *
 * Both `rotateXW` and `rotateYW` are composed in (in that order) — a single rotation
 * plane isn't enough for the slice view to show real variety: see `rotateYW`'s doc
 * comment in `fourd.ts` for why xw-only rotation always leaves the cross-section as a
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
 */
export function RevealStage() {
  const revealView = useDimensionsStore((state) => state.revealView)
  const revealRotationXW = useDimensionsStore((state) => state.revealRotationXW)
  const revealRotationYW = useDimensionsStore((state) => state.revealRotationYW)
  const revealSliceW0 = useDimensionsStore((state) => state.revealSliceW0)
  const material = useTesseractLineMaterial()

  const geometry = useMemo(() => {
    const rotated = rotateYW(rotateXW(TESSERACT_VERTICES, revealRotationXW), revealRotationYW)
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
  }, [revealView, revealRotationXW, revealRotationYW, revealSliceW0])

  useEffect(() => {
    return () => geometry.dispose()
  }, [geometry])

  return (
    <lineSegments geometry={geometry}>
      <primitive object={material} attach="material" />
    </lineSegments>
  )
}
