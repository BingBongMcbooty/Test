import { useEffect, useMemo, useRef } from 'react'
import { useThree, type ThreeEvent } from '@react-three/fiber'
import { Plane, Raycaster, SphereGeometry, Vector2, Vector3 } from 'three'
import { buildCameraFacingPlane, raycastPointerOntoPlane } from '../math/dragPlane'
import { useDimensionsStore } from '../state/store'

/**
 * Radians of rotation per world unit of horizontal plane-raycast movement (shared by
 * both the xw and yw planes — see `handlePointerDown`). PLAN.md leaves Stage 4's drag
 * sensitivity as "tune during Task 14's own playtest" — no analytic derivation, just
 * eyeballed against the reveal camera framing.
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
 * `revealRotationXW`/`revealRotationYW`/`revealSliceW0` updates instead of feeding a
 * `LiveArrow`. The delta's component along the camera's local up axis always drives the
 * slice offset; its component along the camera's local right axis drives rotation, in
 * whichever plane the drag started in — xw normally, yw if Shift was held at
 * pointer-down (checked once per drag, not live, so releasing Shift mid-drag doesn't
 * cause a jarring mode switch). Deltas are frame-to-frame (previous hit to current hit),
 * not anchor-relative, so rotation/offset can accumulate past whatever the drag plane's
 * own practical extent is — the same continuous-accumulation feel as orbit controls.
 *
 * A single rotation plane isn't enough here: driving `rotateXW` alone confines the
 * slice's cutting hyperplane to a normal with no y/z component, so the cross-section is
 * always a full-extent box (see `rotateYW`'s doc comment in `fourd.ts`) — a real
 * playtest surfaced this as the shape just "wobbling" instead of changing. The
 * Shift+drag `rotateYW` control is what actually breaks that degeneracy.
 *
 * `math/fourd.ts`'s `rotateYZ` is still intentionally never driven here, unlike
 * `rotateYW` — it's an ordinary 3D rotation entirely within the visible x/y/z axes, so
 * unlike `rotateYW` it doesn't touch w at all and can't affect what the slice looks
 * like; `ui/CameraDirectionalControls.tsx`'s on-screen camera buttons (Task 17) already
 * give the player that same visual effect by moving the camera itself instead.
 *
 * Task 17: this drag no longer needs to disable `CameraControls` for its duration —
 * `CameraControls.enabled` is permanently `false` now (`Experience.tsx`'s `CameraRig`),
 * so there's nothing left here to fight over with mouse-drag orbit, which no longer
 * exists.
 */
export function RevealDrag() {
  const stage = useDimensionsStore((state) => state.stage)
  const revealWarmupActive = useDimensionsStore((state) => state.revealWarmupActive)
  const rotateRevealXW = useDimensionsStore((state) => state.rotateRevealXW)
  const rotateRevealYW = useDimensionsStore((state) => state.rotateRevealYW)
  const adjustRevealSlice = useDimensionsStore((state) => state.adjustRevealSlice)

  const camera = useThree((state) => state.camera)
  const gl = useThree((state) => state.gl)

  const raycaster = useMemo(() => new Raycaster(), [])
  const dragPlaneRef = useRef<Plane | null>(null)
  const previousHitRef = useRef<Vector3 | null>(null)
  const cleanupRef = useRef<(() => void) | null>(null)

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

    const right = new Vector3().setFromMatrixColumn(camera.matrixWorld, 0)
    const up = new Vector3().setFromMatrixColumn(camera.matrixWorld, 1)
    const rotate = event.shiftKey ? rotateRevealYW : rotateRevealXW

    function onWindowPointerMove(moveEvent: PointerEvent) {
      const plane = dragPlaneRef.current
      const previous = previousHitRef.current
      if (!plane || !previous) return

      const ndc = pointerNDCFromClient(moveEvent.clientX, moveEvent.clientY)
      const hit = raycastPointerOntoPlane(ndc, camera, plane, raycaster)
      if (!hit) return

      const delta = hit.clone().sub(previous)
      rotate(delta.dot(right) * ROTATION_SENSITIVITY)
      adjustRevealSlice(delta.dot(up) * SLICE_SENSITIVITY)

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

  return (
    <>
      {stage === 'reveal' && !revealWarmupActive && (
        <mesh geometry={colliderGeometry} onPointerDown={handlePointerDown}>
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      )}
    </>
  )
}
