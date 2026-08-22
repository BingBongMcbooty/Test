import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { SphereGeometry } from 'three'
import { toCameraRelative, type Vec3Like } from '../math/cameraRelative'
import { useDimensionsStore } from '../state/store'
import { TRACKED_CUBE_VERTEX_COLOR, TRACKED_CUBE_VERTEX_WORLD } from './trackedCubeVertex'

const markerGeometry = new SphereGeometry(0.07, 16, 16)

/** Below this, two readings are the same "no visible change" as far as the store goes. */
const CHANGE_EPSILON = 1e-4

function roughlyEqual(a: Vec3Like, b: Vec3Like): boolean {
  return (
    Math.abs(a.x - b.x) < CHANGE_EPSILON &&
    Math.abs(a.y - b.y) < CHANGE_EPSILON &&
    Math.abs(a.z - b.z) < CHANGE_EPSILON
  )
}

/**
 * Task 24: Stage 3's tracked-cube-vertex readout. `TRACKED_CUBE_VERTEX_WORLD` never
 * moves — the cube itself doesn't rotate in world space, only the camera orbits
 * around it (Task 17's D-pad) — so every frame this recomputes the vertex's position
 * *relative to the camera's current view* (`math/cameraRelative.ts`, confirmed as the
 * intended reading directly by the user — see PROGRESS.md) and writes it to the store
 * for `ui/DimensionPanel.tsx` to display, the same boundary-crossing pattern
 * `CursorTracker.tsx` already uses for `liveCursorPoint`.
 *
 * `useFrame` here deliberately takes **no** explicit priority/render-priority
 * argument — passing any positive number tells R3F "I'm taking over rendering
 * myself," which switches off its own automatic `gl.render()` call every frame
 * (confirmed directly in `@react-three/fiber`'s source: `internal.priority` gates the
 * auto-render line, and any `priority > 0` subscriber increments it). An earlier pass
 * of this file passed `1` to try to force this callback to run after
 * `<CameraControls>`'s own default-priority update — which instead silently blanked
 * *every* stage's canvas (nothing was calling `gl.render()` anymore), caught by an
 * actual `npm run dev`-equivalent look, not by any test. Default priority (`0`, same
 * as every other `useFrame` in this codebase) is correct: `toCameraRelative` already
 * force-refreshes `camera.matrixWorld` itself before reading it, which is what
 * actually guarantees a correct-for-this-frame transform regardless of subscriber
 * ordering — the priority trick was never load-bearing to begin with.
 *
 * Also renders the on-scene marker highlighting the tracked corner, in the same color
 * as its readout row — Task 19's exact "the number and the point read as one thing"
 * pattern (`RevealStage.tsx`'s tesseract marker), reused verbatim one dimension
 * earlier. The marker itself sits at the vertex's literal, unchanging *world*
 * position (it's a real corner of the cube) — only the numbers shown for it are
 * camera-relative, not the dot's own position in the scene.
 */
export function TrackedCubeVertexTracker() {
  const stage = useDimensionsStore((state) => state.stage)
  const camera = useThree((state) => state.camera)
  const setTrackedCubeVertexCamera = useDimensionsStore((state) => state.setTrackedCubeVertexCamera)
  const lastRef = useRef<Vec3Like | null>(null)

  useEffect(() => {
    if (stage !== 'cube') {
      lastRef.current = null
      setTrackedCubeVertexCamera(null)
    }
  }, [stage, setTrackedCubeVertexCamera])

  // Only actually writes to the store when the reading has moved beyond
  // `CHANGE_EPSILON` (or on the very first frame this stage) — the camera sits still
  // most of the time (only the D-pad/spring-back move it), and re-rendering
  // `ui/DimensionPanel.tsx` every single frame regardless would be pure waste on a
  // stage whose shader material (Task 7) is already the heaviest thing in the scene —
  // see `e2e/richness.spec.ts`'s frame-rate floor.
  useFrame(() => {
    if (stage !== 'cube') return
    const next = toCameraRelative(TRACKED_CUBE_VERTEX_WORLD, camera)
    if (lastRef.current && roughlyEqual(lastRef.current, next)) return
    lastRef.current = next
    setTrackedCubeVertexCamera(next)
  })

  if (stage !== 'cube') return null

  return (
    <mesh geometry={markerGeometry} position={TRACKED_CUBE_VERTEX_WORLD}>
      <meshBasicMaterial color={TRACKED_CUBE_VERTEX_COLOR} />
    </mesh>
  )
}
