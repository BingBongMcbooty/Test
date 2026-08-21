import { useEffect, useMemo, useRef, useState } from 'react'
import { useThree, type ThreeEvent } from '@react-three/fiber'
import {
  BufferGeometry,
  DoubleSide,
  Float32BufferAttribute,
  Plane,
  Raycaster,
  SphereGeometry,
  Vector2,
  Vector3,
} from 'three'
import { buildCameraFacingPlane, raycastPointerOntoPlane } from '../math/dragPlane'
import {
  CONE_EDGES,
  CONE_FACES,
  CONE_SLICE_RANGE,
  CONE_VERTICES,
  type ConeEdge,
  type Point3,
  type SliceSegment,
  sliceCone,
  tiltCone,
} from '../math/coneSlice'
import { useDimensionsStore } from '../state/store'
import { useTesseractLineMaterial } from './materials'

/**
 * Visual scale applied to `math/coneSlice.ts`'s unit-radius/height-2 local coordinates —
 * picked to roughly match `RevealStage.tsx`'s `TESSERACT_SCALE` (the shape this warm-up
 * hands off to) so the transition into the real tesseract isn't a jarring size change.
 */
const CONE_SCALE = 1.3

/** Where the "alongside" 2D cross-section view sits, offset from the cone itself. */
const CROSS_SECTION_OFFSET: readonly [number, number, number] = [2.6, 0, 0]
const CROSS_SECTION_SCALE = 1.6

/**
 * Radians of tilt per world unit of horizontal drag-plane movement, and z0 offset per
 * world unit of vertical movement — starting from `RevealDrag.tsx`'s own
 * `ROTATION_SENSITIVITY`/`SLICE_SENSITIVITY` since this plays out against the exact same
 * reveal-stage camera framing; free to retune independently if a playtest wants
 * something different for the smaller/simpler cone interaction.
 */
const TILT_SENSITIVITY = 1.4
const SLICE_SENSITIVITY = 0.9

// Generously sized relative to the cone's + cross-section inset's combined on-screen
// footprint — same "inflated invisible collider" idea as `RevealDrag.tsx`'s own sphere.
const colliderGeometry = new SphereGeometry(3, 12, 12)

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function coneEdgesToPositions(
  vertices: readonly Point3[],
  edges: readonly ConeEdge[],
  scale: number,
): Float32Array {
  const positions = new Float32Array(edges.length * 6)
  edges.forEach(({ a, b }, i) => {
    const va = vertices[a]
    const vb = vertices[b]
    positions[i * 6 + 0] = va.x * scale
    positions[i * 6 + 1] = va.y * scale
    positions[i * 6 + 2] = va.z * scale
    positions[i * 6 + 3] = vb.x * scale
    positions[i * 6 + 4] = vb.y * scale
    positions[i * 6 + 5] = vb.z * scale
  })
  return positions
}

function sliceSegmentsToPositions(
  segments: readonly SliceSegment[],
  scale: number,
  offset: readonly [number, number, number],
): Float32Array {
  const positions = new Float32Array(segments.length * 6)
  segments.forEach(({ a, b }, i) => {
    positions[i * 6 + 0] = a.x * scale + offset[0]
    positions[i * 6 + 1] = a.y * scale + offset[1]
    positions[i * 6 + 2] = offset[2]
    positions[i * 6 + 3] = b.x * scale + offset[0]
    positions[i * 6 + 4] = b.y * scale + offset[1]
    positions[i * 6 + 5] = offset[2]
  })
  return positions
}

/**
 * Task 20: a short, skippable warm-up shown on first entering the reveal stage, before
 * `RevealStage.tsx`'s tesseract takes over (see `state/store.ts`'s `revealWarmupActive`
 * for how that handoff is gated). An ordinary 3D cone gets cut by a fixed z=z0 plane,
 * with the resulting 2D cross-section drawn alongside it — the same
 * rotate-the-shape/offset-the-fixed-hyperplane interaction `RevealDrag.tsx` uses one
 * dimension up, so the control itself is already familiar by the time the real 4D
 * version arrives.
 *
 * Unlike `RevealStage`/`RevealDrag`, this component owns both the drag interaction and
 * the render itself rather than splitting them across two files mediated by the global
 * store: nothing outside this component needs the cone's tilt/slice state (no
 * instrumentation panel reads it, unlike `revealRotationXW`/`revealSliceW0`), so it's
 * plain local `useState` instead of a new store slice, per CLAUDE.md/PLAN.md's Task
 * 3/10 note that per-interaction state that nothing else needs stays local.
 *
 * The cone tilts (not the cutting plane) to vary the conic section, matching
 * `fourd.ts`'s own approach of rotating the shape against an always-fixed slicing
 * hyperplane rather than the other way around — see `coneSlice.ts`'s `tiltCone` doc
 * comment for why a single tilt axis is already enough here (unlike the tesseract's
 * two rotation planes).
 */
export function SliceWarmup() {
  const stage = useDimensionsStore((state) => state.stage)
  const revealWarmupActive = useDimensionsStore((state) => state.revealWarmupActive)
  const active = stage === 'reveal' && revealWarmupActive

  const material = useTesseractLineMaterial()
  const [tilt, setTilt] = useState(0)
  const [sliceZ0, setSliceZ0] = useState(0)

  const camera = useThree((state) => state.camera)
  const gl = useThree((state) => state.gl)

  const raycaster = useMemo(() => new Raycaster(), [])
  const dragPlaneRef = useRef<Plane | null>(null)
  const previousHitRef = useRef<Vector3 | null>(null)
  const cleanupRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    return () => cleanupRef.current?.()
  }, [])

  // Dev-only escape hatch, same spirit as `state/store.ts`'s `window.__dimensionsStore`
  // and `Experience.tsx`'s `window.__cameraControls`: `tilt`/`sliceZ0` are plain local
  // state (nothing else in the app needs them), so a Playwright test confirming a drag
  // actually changed the cone's tilt/slice — not just its animated wireframe color drift
  // — needs a way to read them directly instead of screenshot-diffing. Dead code
  // eliminated from the production build, same as the other two hooks.
  useEffect(() => {
    if (import.meta.env.DEV) {
      Object.assign(window, { __sliceWarmupState: { tilt, sliceZ0 } })
    }
  }, [tilt, sliceZ0])

  const tiltedVertices = useMemo(() => tiltCone(CONE_VERTICES, tilt), [tilt])

  const coneGeometry = useMemo(() => {
    const geo = new BufferGeometry()
    geo.setAttribute(
      'position',
      new Float32BufferAttribute(coneEdgesToPositions(tiltedVertices, CONE_EDGES, CONE_SCALE), 3),
    )
    return geo
  }, [tiltedVertices])

  useEffect(() => {
    return () => coneGeometry.dispose()
  }, [coneGeometry])

  const crossSectionGeometry = useMemo(() => {
    const segments = sliceCone(tiltedVertices, CONE_FACES, sliceZ0)
    const geo = new BufferGeometry()
    geo.setAttribute(
      'position',
      new Float32BufferAttribute(
        sliceSegmentsToPositions(segments, CROSS_SECTION_SCALE, CROSS_SECTION_OFFSET),
        3,
      ),
    )
    return geo
  }, [tiltedVertices, sliceZ0])

  useEffect(() => {
    return () => crossSectionGeometry.dispose()
  }, [crossSectionGeometry])

  function pointerNDCFromClient(clientX: number, clientY: number): Vector2 {
    const rect = gl.domElement.getBoundingClientRect()
    return new Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -(((clientY - rect.top) / rect.height) * 2 - 1),
    )
  }

  function handlePointerDown(event: ThreeEvent<PointerEvent>) {
    event.stopPropagation()

    const anchor = event.point.clone()
    dragPlaneRef.current = buildCameraFacingPlane(anchor, camera)
    previousHitRef.current = anchor

    const right = new Vector3().setFromMatrixColumn(camera.matrixWorld, 0)
    const up = new Vector3().setFromMatrixColumn(camera.matrixWorld, 1)

    function onWindowPointerMove(moveEvent: PointerEvent) {
      const plane = dragPlaneRef.current
      const previous = previousHitRef.current
      if (!plane || !previous) return

      const ndc = pointerNDCFromClient(moveEvent.clientX, moveEvent.clientY)
      const hit = raycastPointerOntoPlane(ndc, camera, plane, raycaster)
      if (!hit) return

      const delta = hit.clone().sub(previous)
      setTilt((t) => t + delta.dot(right) * TILT_SENSITIVITY)
      setSliceZ0((z0) =>
        clamp(z0 + delta.dot(up) * SLICE_SENSITIVITY, -CONE_SLICE_RANGE, CONE_SLICE_RANGE),
      )

      previousHitRef.current = hit
    }

    function onWindowPointerUp() {
      cleanupRef.current?.()
      cleanupRef.current = null
      dragPlaneRef.current = null
      previousHitRef.current = null
    }

    window.addEventListener('pointermove', onWindowPointerMove)
    window.addEventListener('pointerup', onWindowPointerUp)
    cleanupRef.current = () => {
      window.removeEventListener('pointermove', onWindowPointerMove)
      window.removeEventListener('pointerup', onWindowPointerUp)
    }
  }

  if (!active) return null

  return (
    <>
      <mesh geometry={colliderGeometry} onPointerDown={handlePointerDown}>
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      <lineSegments geometry={coneGeometry}>
        <primitive object={material} attach="material" />
      </lineSegments>

      {/* The cutting plane itself — always flat/world-axis-aligned, never tilted, since
          it's the cone that tilts against a fixed slicing plane (see doc comment above). */}
      <mesh position={[0, 0, sliceZ0 * CONE_SCALE]}>
        <circleGeometry args={[1.7, 32]} />
        <meshBasicMaterial
          color="#ffb454"
          transparent
          opacity={0.16}
          side={DoubleSide}
          depthWrite={false}
        />
      </mesh>

      {/* A small backdrop "screen" behind the alongside 2D cross-section, so it reads as
          its own separate view rather than floating lines in the same 3D space. */}
      <mesh
        position={[
          CROSS_SECTION_OFFSET[0],
          CROSS_SECTION_OFFSET[1],
          CROSS_SECTION_OFFSET[2] - 0.05,
        ]}
      >
        <planeGeometry args={[3.4, 3.4]} />
        <meshBasicMaterial color="#14141c" transparent opacity={0.55} depthWrite={false} />
      </mesh>

      <lineSegments geometry={crossSectionGeometry}>
        <lineBasicMaterial color="#ffb454" />
      </lineSegments>
    </>
  )
}
