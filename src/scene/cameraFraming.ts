import type { Stage } from '../state/stageConfig'

export interface CameraFraming {
  position: readonly [number, number, number]
  target: readonly [number, number, number]
  /**
   * Task 17: whether `ui/CameraDirectionalControls.tsx`'s on-screen buttons render and
   * work at this stage. Mouse-drag itself never orbits the camera anywhere anymore
   * (`CameraControls.enabled` is permanently `false` — see `Experience.tsx`'s
   * `CameraRig`) — this only gates the *button*-driven replacement. Stage 1 (line)
   * stays fully locked (`false`, no buttons at all): the whole point of "a line is a 1D
   * world" collapses if the player can look around it and see it's really sitting in 3D
   * space — see PROGRESS.md's post-Task-15 design pivot note. Stage 2 (plane) gets a
   * *limited* range (see `azimuthRange`/`polarRange`) rather than none at all or the
   * unclamped range Stage 3+ gets — see those fields' own doc comments for why.
   */
  cameraControlsEnabled: boolean
  /**
   * Absolute azimuth-angle bounds (radians) the on-screen buttons may rotate within, in
   * `camera-controls`' own fixed world-space reference frame (not relative to this
   * stage's `position`/`target`) — passed straight through to `CameraControls`'
   * `minAzimuthAngle`/`maxAzimuthAngle` props, so `.rotate()` calls clamp exactly like
   * mouse-drag orbit used to. Only meaningful when `cameraControlsEnabled`. Omitted
   * (full `-Infinity..Infinity`) for Stage 1, which never renders the buttons at all.
   */
  azimuthRange?: readonly [number, number]
  /** Same idea as `azimuthRange`, for `minPolarAngle`/`maxPolarAngle`. */
  polarRange?: readonly [number, number]
}

/**
 * Task 17: how far (radians) Stage 2's on-screen camera buttons may tilt away from its
 * dead-on resting view, in either azimuth or polar direction. This is what actually
 * resolves Stage 2's long-open camera tension (see PROGRESS.md's Task 16 notes and
 * PLAN.md's Task 17 text): the *resting* framing can now be fully dead-on (reads
 * unambiguously as "this is flat," matching Stage 1's treatment) because "leaving the
 * plane" no longer has to stay geometrically draggable at that exact angle — the player
 * presses a button to tilt away from dead-on first, which is what puts a z-component
 * back into the camera-facing drag plane's normal, then drags. `1.0` rad (~57°) is the
 * empirically-swept value (see PROGRESS.md's Task 17 notes) — `0.6` rad only reaches a
 * best-case ratio of ~0.565 (still short of `ORTHOGONALITY_THRESHOLD = 0.7`), and `0.8`
 * clears it only right at the margin (~0.71, unreliable run to run at that razor's
 * edge); `1.0` clears it comfortably (~0.83 best case) with real headroom. Not a value
 * with any 3D-scene analytic derivation open to it, same as Task 11's original
 * oblique-angle deltas.
 */
export const PLANE_TILT_RANGE = 1.0

/**
 * Per-stage camera position/target, applied instantly (no transition yet — that
 * arrives with Task 10's stage-advance animation). Distances grow slightly with each
 * stage so the larger shapes stay comfortably framed.
 *
 * Stage 1 (line) uses a straight-on, dead-center framing (looking straight down -z at
 * the line, which lies along x) rather than the oblique 3/4 angle Stages 3+ use —
 * combined with `orbitEnabled: false`, this is what makes it read as "this is all
 * there is" rather than "an object floating in a 3D scene I just haven't rotated yet."
 * That works here because "leaving the line" only needs *some* y (or z) component, and
 * a dead-on-z camera's drag plane still lets y vary freely.
 *
 * Stage 2 (plane) moved to the same dead-on, straight-ahead treatment as Stage 1 in
 * Task 17, once mouse-drag orbit stopped existing anywhere: a truly dead-on-z camera
 * makes z (the axis "leaving the plane" needs) mathematically unreachable by any 2D
 * mouse drag *at that exact angle*, since `dragPlane.ts`'s camera-facing drag surface
 * would then be the z=0 plane itself — but the player now has `cameraControlsEnabled`
 * buttons (within `azimuthRange`/`polarRange`, `PLANE_TILT_RANGE` wide) to tilt away
 * from dead-on before dragging, which is what makes z reachable again without giving up
 * the flat resting view. See PROGRESS.md's Task 16 and Task 17 notes for the tension
 * this replaces and how Task 17 resolves it.
 *
 * Task 16: every position/target pair below is the pre-Task-16 origin-centered value
 * translated by that stage's own `shapePositions.ts` offset — each shape moved to sit
 * fully within the positive octant (to match the new coordinate-space grids), and the
 * camera moved by the exact same vector so the view itself is untouched (same relative
 * angle/distance to the shape, same screen-space mapping from a mouse drag to a world
 * vector). This is what keeps every pre-existing drag/validation test passing
 * unmodified — see `shapePositions.ts`'s doc comment for why a shared translation
 * preserves that mapping exactly. Stage 2's Task 17 re-framing (dead-on rather than the
 * old oblique angle) is a deliberate exception to that preservation — see above.
 */
const FULL_AZIMUTH_RANGE: readonly [number, number] = [-Infinity, Infinity]
const FULL_POLAR_RANGE: readonly [number, number] = [0, Math.PI]

export const CAMERA_FRAMING: Record<Stage, CameraFraming> = {
  line: { position: [1.5, 0, 5], target: [1.5, 0, 0], cameraControlsEnabled: false },
  plane: {
    position: [1.5, 1.5, 5],
    target: [1.5, 1.5, 0],
    cameraControlsEnabled: true,
    azimuthRange: [-PLANE_TILT_RANGE, PLANE_TILT_RANGE],
    polarRange: [Math.PI / 2 - PLANE_TILT_RANGE, Math.PI / 2 + PLANE_TILT_RANGE],
  },
  cube: {
    position: [4.75, 4.75, 5.75],
    target: [1.25, 1.25, 1.25],
    cameraControlsEnabled: true,
    azimuthRange: FULL_AZIMUTH_RANGE,
    polarRange: FULL_POLAR_RANGE,
  },
  reveal: {
    position: [4, 3.5, 5],
    target: [0, 0, 0],
    cameraControlsEnabled: true,
    azimuthRange: FULL_AZIMUTH_RANGE,
    polarRange: FULL_POLAR_RANGE,
  },
  closing: {
    position: [4, 3.5, 5],
    target: [0, 0, 0],
    cameraControlsEnabled: true,
    azimuthRange: FULL_AZIMUTH_RANGE,
    polarRange: FULL_POLAR_RANGE,
  },
}
