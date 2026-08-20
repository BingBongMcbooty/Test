import { useEffect, useMemo, useRef, useState } from 'react'
import { useThree, type ThreeEvent } from '@react-three/fiber'
import type { CameraControlsImpl } from '@react-three/drei'
import { BoxGeometry, CylinderGeometry, DoubleSide, PlaneGeometry, Plane, Raycaster, Vector2, Vector3 } from 'three'
import { useDimensionsStore } from '../state/store'
import { buildCameraFacingPlane, raycastPointerOntoPlane } from '../math/dragPlane'
import { evaluateAttempt } from '../math/validation'
import { STAGE_CONFIG } from '../state/stageConfig'
import { FAIL_CUE_DURATION, FailCueArrow } from './FailCueArrow'
import { LiveArrow } from './LiveArrow'

/**
 * A drag has to travel at least this far (world units) from its anchor before it counts
 * as a real attempt rather than an accidental click/jitter — below this, no arrow shows
 * at all. PLAN.md's "discard too-short drags," implemented as a dead zone since there's
 * no pass/fail logic yet (Task 11) for a finished drag to be discarded *from*.
 */
const MIN_DRAG_LENGTH = 0.2

// Invisible, slightly inflated hit-test colliders for each stage's visible shape. The
// line is a bare `lineSegments` with no surface to raycast against at all, and the
// plane/cube's real fills are a comfortably tight fit for their wireframes — each stage
// gets its own generously-sized invisible mesh rather than raycasting the visible
// geometry directly. Module-scoped and reused across renders, same reasoning as
// `LiveArrow`'s shared geometries.
const lineColliderGeometry = new CylinderGeometry(0.3, 0.3, 3.2, 8)
const planeColliderGeometry = new PlaneGeometry(3.6, 3.6)
const cubeColliderGeometry = new BoxGeometry(2.7, 2.7, 2.7)

interface LiveDrag {
  start: Vector3
  end: Vector3
}

/**
 * Pointer-down hit-tests the current stage's collider; a hit enters draw mode (disables
 * `CameraControls` for the duration, per PLAN.md) and feeds `LiveArrow` from Task 8's
 * camera-facing-plane raycast on every pointer-move, restoring orbit on pointer-up. A
 * miss does nothing, leaving `CameraControls`' own listeners to handle the orbit as
 * usual. Per CLAUDE.md, the live drag's points stay local component state — only the
 * `isDrawing` flag (a store concern since Task 3) is shared globally.
 *
 * Task 11: on pointer-up, a drag that cleared the dead zone is handed to
 * `evaluateAttempt` (`math/validation.ts`) against the current stage's occupied axes.
 * Success calls `advanceStage()` (the camera transition into the next stage lives in
 * `Experience.tsx`'s `CameraRig`); failure freezes the drag as a `FailCueArrow` that
 * flashes/fades in place instead of `LiveArrow`'s stage-driven material — see
 * `FailCueArrow`'s doc comment for why that's a separate component rather than a
 * change to `useArrowMaterial`.
 */
export function ArrowDrag() {
  const stage = useDimensionsStore((state) => state.stage)
  const startDrawing = useDimensionsStore((state) => state.startDrawing)
  const endDrawing = useDimensionsStore((state) => state.endDrawing)

  const camera = useThree((state) => state.camera)
  const gl = useThree((state) => state.gl)
  const controlsFromStore = useThree((state) => state.controls) as CameraControlsImpl | null

  const [liveDrag, setLiveDrag] = useState<LiveDrag | null>(null)
  const [failCue, setFailCue] = useState<LiveDrag | null>(null)
  const raycaster = useMemo(() => new Raycaster(), [])
  const dragPlaneRef = useRef<Plane | null>(null)
  const dragStartRef = useRef<Vector3 | null>(null)
  const dragEndRef = useRef<Vector3 | null>(null)
  const cleanupRef = useRef<(() => void) | null>(null)
  const failCueTimeoutRef = useRef<number | null>(null)
  // `CameraControls` (drei's `makeDefault`-registered instance) is an external,
  // intentionally-mutable object — mirrored into a plain ref (rather than toggling
  // `.enabled` on the `useThree()`-selected value directly) since the compiler-based
  // react-hooks/immutability rule treats a hook's return value as frozen outside its
  // own factory, the same rule Task 7/9's material notes work around for `ShaderMaterial`.
  const controlsRef = useRef<CameraControlsImpl | null>(null)
  useEffect(() => {
    controlsRef.current = controlsFromStore
  }, [controlsFromStore])

  useEffect(() => {
    return () => {
      if (failCueTimeoutRef.current !== null) window.clearTimeout(failCueTimeoutRef.current)
    }
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

    // A new drag pre-empts any fail cue still fading from the previous one.
    if (failCueTimeoutRef.current !== null) {
      window.clearTimeout(failCueTimeoutRef.current)
      failCueTimeoutRef.current = null
    }
    setFailCue(null)

    const anchor = event.point.clone()
    dragPlaneRef.current = buildCameraFacingPlane(anchor, camera)
    dragStartRef.current = anchor
    dragEndRef.current = anchor

    if (controlsRef.current) controlsRef.current.enabled = false
    startDrawing()

    function onWindowPointerMove(moveEvent: PointerEvent) {
      const plane = dragPlaneRef.current
      const start = dragStartRef.current
      if (!plane || !start) return

      const ndc = pointerNDCFromClient(moveEvent.clientX, moveEvent.clientY)
      const hit = raycastPointerOntoPlane(ndc, camera, plane, raycaster)
      if (!hit) return

      dragEndRef.current = hit
      setLiveDrag(hit.distanceTo(start) >= MIN_DRAG_LENGTH ? { start, end: hit } : null)

      // Task 15's one narrow exception to "per-drag state stays local" (see store.ts's
      // `liveDragVector` doc comment) — everything else in this handler is untouched.
      const dragVector = hit.clone().sub(start)
      useDimensionsStore
        .getState()
        .setLiveDragVector({ x: dragVector.x, y: dragVector.y, z: dragVector.z })
    }

    function onWindowPointerUp() {
      cleanupRef.current?.()
      cleanupRef.current = null
      if (controlsRef.current) controlsRef.current.enabled = true
      endDrawing()

      const start = dragStartRef.current
      const end = dragEndRef.current
      dragPlaneRef.current = null
      dragStartRef.current = null
      dragEndRef.current = null
      setLiveDrag(null)
      useDimensionsStore.getState().setLiveDragVector(null)

      // Too-short drags never counted as a real attempt (Task 10's dead zone) — discard
      // without calling evaluateAttempt at all.
      if (!start || !end || end.distanceTo(start) < MIN_DRAG_LENGTH) return

      const dragVector = end.clone().sub(start)
      const result = evaluateAttempt(
        { x: dragVector.x, y: dragVector.y, z: dragVector.z },
        STAGE_CONFIG[stage].occupiedAxes,
      )
      useDimensionsStore.getState().recordAttempt(result)

      if (result.success) {
        useDimensionsStore.getState().advanceStage()
      } else {
        setFailCue({ start, end })
        failCueTimeoutRef.current = window.setTimeout(() => {
          failCueTimeoutRef.current = null
          setFailCue(null)
        }, FAIL_CUE_DURATION * 1000)
      }
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
      {stage === 'line' && (
        <mesh
          geometry={lineColliderGeometry}
          rotation={[0, 0, Math.PI / 2]}
          onPointerDown={handlePointerDown}
        >
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      )}
      {stage === 'plane' && (
        <mesh geometry={planeColliderGeometry} onPointerDown={handlePointerDown}>
          <meshBasicMaterial transparent opacity={0} depthWrite={false} side={DoubleSide} />
        </mesh>
      )}
      {stage === 'cube' && (
        <mesh geometry={cubeColliderGeometry} onPointerDown={handlePointerDown}>
          <meshBasicMaterial transparent opacity={0} depthWrite={false} side={DoubleSide} />
        </mesh>
      )}
      {liveDrag && <LiveArrow start={liveDrag.start} end={liveDrag.end} />}
      {failCue && <FailCueArrow start={failCue.start} end={failCue.end} />}
    </>
  )
}
