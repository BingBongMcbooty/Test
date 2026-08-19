import { useEffect, useMemo, useRef } from 'react'
import { useThree, type ThreeEvent } from '@react-three/fiber'
import type { CameraControlsImpl } from '@react-three/drei'
import { Plane, Raycaster, SphereGeometry, Vector2, Vector3 } from 'three'
import { buildCameraFacingPlane, raycastPointerOntoPlane } from '../math/dragPlane'
import { useDimensionsStore } from '../state/store'

/**
 * Radians of xw-plane rotation per world unit of horizontal plane-raycast movement.
 * PLAN.md leaves Stage 4's drag sensitivity as "tune during Task 14's own playtest" —
 * no analytic derivation, just eyeballed against the reveal camera framing.
 */
const ROTATION_SENSITIVITY = 1.4

/** revealSliceW0 units per world unit of vertical plane-raycast movement. */
const SLICE_SENSITIVITY = 0.9

// Generously sized relative to the tesseract's largest possible on-screen extent
// (RevealStage.tsx's TESSERACT_SCALE times the projection view's max perspective
// scale-up) — same "inflated invisible collider" idea as ArrowDrag.tsx's per-stage
// colliders, just a sphere since the reveal shape isn't a fixed box/plane/line.
const colliderGeometry = new SphereGeometry(2.2, 12, 12)

/**
 * Stage 4's own drag controller — deliberately separate from `ArrowDrag.tsx` rather than
 * folded into it, since this isn't the arrow-drawing puzzle: no `evaluateAttempt`, no
 * pass/fail, no arrow ever drawn. It reuses `math/dragPlane.ts`'s camera-facing-plane
 * raycast the same way `ArrowDrag` does (PLAN.md: "the same drag mechanic ...
 * repurposed"), but converts each frame's incremental raycast delta straight into
 * `revealRotation`/`revealSliceW0` updates instead of feeding a `LiveArrow`: the delta's
 * component along the camera's local right axis drives rotation, its component along the
 * camera's local up axis drives the slice offset. Deltas are frame-to-frame (previous hit
 * to current hit), not anchor-relative, so rotation/offset can accumulate past whatever
 * the drag plane's own practical extent is — the same continuous-accumulation feel as
 * orbit controls.
 *
 * `math/fourd.ts`'s `rotateYZ` is intentionally never driven here. It's an ordinary 3D
 * rotation entirely within the visible x/y/z axes — `CameraControls`' existing free orbit
 * already gives the player that for free by moving the camera instead. The one rotation
 * actually worth spending the drag on is xw, since it's the only one that moves the shape
 * through the hidden 4th axis the whole stage is about.
 */
export function RevealDrag() {
  const stage = useDimensionsStore((state) => state.stage)
  const rotateReveal = useDimensionsStore((state) => state.rotateReveal)
  const adjustRevealSlice = useDimensionsStore((state) => state.adjustRevealSlice)

  const camera = useThree((state) => state.camera)
  const gl = useThree((state) => state.gl)
  const controlsFromStore = useThree((state) => state.controls) as CameraControlsImpl | null

  const raycaster = useMemo(() => new Raycaster(), [])
  const dragPlaneRef = useRef<Plane | null>(null)
  const previousHitRef = useRef<Vector3 | null>(null)
  const cleanupRef = useRef<(() => void) | null>(null)
  // Same ref-mirroring workaround as ArrowDrag.tsx: mutating `.enabled` on the
  // `useThree()`-selected controls value directly trips the compiler-based
  // react-hooks immutability check.
  const controlsRef = useRef<CameraControlsImpl | null>(null)
  useEffect(() => {
    controlsRef.current = controlsFromStore
  }, [controlsFromStore])

  useEffect(() => {
    return () => cleanupRef.current?.()
  }, [])

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

    if (controlsRef.current) controlsRef.current.enabled = false

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
      rotateReveal(delta.dot(right) * ROTATION_SENSITIVITY)
      adjustRevealSlice(delta.dot(up) * SLICE_SENSITIVITY)

      previousHitRef.current = hit
    }

    function onWindowPointerUp() {
      cleanupRef.current?.()
      cleanupRef.current = null
      if (controlsRef.current) controlsRef.current.enabled = true
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

  return (
    <>
      {stage === 'reveal' && (
        <mesh geometry={colliderGeometry} onPointerDown={handlePointerDown}>
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      )}
    </>
  )
}
