import type { AxisSign, Stage } from '../state/stageConfig'
import { LINE_POSITION, cubePosition, planePosition } from './shapePositions'

export interface CameraFraming {
  position: readonly [number, number, number]
  target: readonly [number, number, number]
  /**
   * Task 23: absolute azimuth-angle bounds (radians, in `camera-controls`' own fixed
   * world-space reference frame) within which `ui/CameraDirectionalControls.tsx`'s
   * buttons move the camera completely freely — no resistance, no spring-back. Pushing
   * a button past either edge still moves the camera (see `resistedStep` below) but
   * increasingly reluctantly the further out it already is, and once the player stops
   * pushing, a value left outside this range eases back to the nearest edge (see
   * `Experience.tsx`'s `CameraRig`, which runs `easedTowardRange` every frame).
   *
   * Through Task 17 this field (and `polarRange`) was optional and used as a HARD
   * clamp, passed straight to `CameraControls`' own `minAzimuthAngle`/
   * `maxAzimuthAngle` — Stage 1 didn't define it at all because its buttons didn't
   * exist yet. Task 23 makes buttons universal and repurposes these same two fields
   * (per the plan's own note to reuse rather than replace them) as the soft "free
   * zone" boundary instead: every stage now defines a finite range. Stage 1's is
   * zero-width (`[restAzimuth, restAzimuth]`) — any deviation at all faces resistance
   * and springs back, matching its "this is all there is" 1D framing. Stage 2 keeps
   * `PLANE_TILT_RANGE`'s width. Stage 3 on uses the full unclamped range, so excess is
   * always exactly zero and both mechanisms below are permanently no-ops there — still
   * completely free movement, no spring-back, exactly Task 17's original behavior.
   * `CameraControls` itself no longer enforces any per-stage clamp at all
   * (`Experience.tsx` now always passes the full natural range) — resistance and
   * spring-back live entirely in this app's own code so a press can still be felt
   * (rather than hitting a dead stop) even past where a stage "shouldn't" go.
   */
  azimuthRange: readonly [number, number]
  /** Same idea as `azimuthRange`, for polar angle. */
  polarRange: readonly [number, number]
}

/**
 * Task 17: how far (radians) Stage 2's on-screen camera buttons' free-movement zone
 * extends from its dead-on resting view, in either azimuth or polar direction. This is
 * what actually resolves Stage 2's long-open camera tension (see PROGRESS.md's Task 16
 * notes and PLAN.md's Task 17 text): the *resting* framing can now be fully dead-on
 * (reads unambiguously as "this is flat," matching Stage 1's treatment) because
 * "leaving the plane" no longer has to stay geometrically draggable at that exact
 * angle — the player presses a button to tilt away from dead-on first, which is what
 * puts a z-component back into the camera-facing drag plane's normal, then drags. `1.0`
 * rad (~57°) is the empirically-swept value (see PROGRESS.md's Task 17 notes) — `0.6`
 * rad only reaches a best-case ratio of ~0.565 (still short of
 * `ORTHOGONALITY_THRESHOLD = 0.7`), and `0.8` clears it only right at the margin
 * (~0.71, unreliable run to run at that razor's edge); `1.0` clears it comfortably
 * (~0.83 best case) with real headroom. Not a value with any 3D-scene analytic
 * derivation open to it, same as Task 11's original oblique-angle deltas.
 *
 * Task 23: this is now also the width of Stage 2's *free* (resistance-free) button
 * range rather than a hard clamp — see `CameraFraming.azimuthRange`'s doc comment.
 * Reused as-is rather than retuned, since the underlying reachability math it was
 * swept against hasn't changed.
 */
export const PLANE_TILT_RANGE = 1.0

/**
 * Task 23 tunable: the excess distance (radians, past a stage's free-range boundary)
 * over which `resistedStep`'s falloff decays by a factor of `e`. Smaller = resistance
 * ramps up faster (feels stiffer close to the boundary, and bounds how far a
 * *sustained* hold can creep); larger = softer, more gradual give.
 *
 * Empirically swept, not guessed, the same spirit as Task 17's `PLANE_TILT_RANGE`
 * sweep — see PROGRESS.md's Task 23 notes. A first pass used a rational falloff
 * (`1 / (1 + excess / d)`) with `d = 0.5`, which looked reasonable for a handful of
 * quick clicks but, checked against a real sustained button *hold* (repeat ticks every
 * `HOLD_REPEAT_MS`, `CameraDirectionalControls.tsx`) via `window.__cameraControls` in
 * a running `npm run dev`, let Stage 2's tilt climb to ~2.7 rad (past 150°!) after just
 * 1.5s of holding — a rational falloff only decays like `1/excess`, so the cumulative
 * position under continuous holding grows like `sqrt(time)`, unbounded in practice.
 * Switching to an exponential falloff (`exp(-excess / d)`, decaying like `1/e^excess`)
 * and sweeping `d` down from `0.5` to `0.15` keeps even an extended hold (3+ seconds)
 * within roughly half a radian of the boundary while still passing a single unresisted
 * step right at the boundary itself (so the very first press past it still reads as a
 * real, felt nudge — see `resistedStep`'s "at rest" test case) — the combination that
 * actually reads as resistance rather than "the button still does whatever it wants if
 * you hold it long enough."
 */
export const RESISTANCE_DISTANCE = 0.15

/**
 * Task 23 tunable: how fast the spring-back loop (`Experience.tsx`'s `CameraRig`)
 * closes the gap between the camera's current angle and its free-range boundary, once
 * outside it and the library reports no transition of its own is active (see that
 * component's comment for why `controls.active` is the right gate). Framed as an
 * exponential decay rate — each frame closes a `1 - exp(-SPRING_BACK_SHARPNESS *
 * delta)` fraction of the remaining gap — rather than a fixed duration, so it's
 * frame-rate independent and always closes the *relative* gap at the same rate
 * regardless of how far out the player pushed. `6` settles a typical overshoot within
 * well under a second, comfortably inside every e2e test's existing settle-polling
 * budget (`waitForCameraSettled`, up to 3s).
 */
export const SPRING_BACK_SHARPNESS = 6

/**
 * Task 23: given the camera's current angle on one axis and a raw requested step
 * (signed: positive = increasing angle), returns the resisted step actually applied.
 * Inside `range` the full step always applies unchanged — this is what makes Stage
 * 3+'s totally free unclamped range (and the untouched interior of Stage 1/2's own
 * range) behave exactly as before. Once the *current* angle is already past whichever
 * edge the step is heading further past, the step is scaled down by an exponential
 * falloff (`exp(-excess / RESISTANCE_DISTANCE)`) the further past it already is —
 * chosen over a slower-decaying "rubber band" (`1 / (1 + excess / d)`) specifically so
 * a *sustained* hold's cumulative creep stays bounded rather than merely slowed (see
 * `RESISTANCE_DISTANCE`'s own doc comment for the empirical reasoning). Never a hard
 * cap, though — a large enough `excess` still yields a tiny nonzero step, so repeated
 * presses always nudge a little further, just with rapidly diminishing effect instead
 * of stopping dead. A step heading back *toward* the free range (e.g. the player
 * reverses direction after pushing past an edge) is never resisted, only a step
 * continuing further out is — resistance opposes leaving the free zone, not returning
 * to it.
 */
export function resistedStep(
  current: number,
  rawStep: number,
  range: readonly [number, number],
): number {
  if (rawStep === 0) return 0
  const [min, max] = range
  const excess = rawStep > 0 ? Math.max(0, current - max) : Math.max(0, min - current)
  if (excess === 0) return rawStep
  const factor = Math.exp(-excess / RESISTANCE_DISTANCE)
  return rawStep * factor
}

/**
 * Task 23: one frame's worth of spring-back easing for a single axis. Returns
 * `current` unchanged when it's already inside `range`. Otherwise eases it a `t`
 * fraction of the way toward the *nearest* edge of `range` (never past it, never all
 * the way to some separate "true rest" value — for Stage 2 this means settling back at
 * its tilt boundary, not all the way to dead-on, matching PLAN.md's Task 23 verify
 * step). `t` is expected to be `1 - exp(-SPRING_BACK_SHARPNESS * delta)` (see
 * `Experience.tsx`'s `CameraRig`) — an exponential approach that, left running, snaps
 * exactly to the target once the remaining gap underflows floating-point precision.
 * The explicit epsilon snap below just gets there a touch sooner, so e2e polling that
 * waits for two consecutive bit-identical reads (`waitForCameraSettled`) doesn't have
 * to wait out an unnecessarily long asymptotic tail.
 */
export function easedTowardRange(
  current: number,
  range: readonly [number, number],
  t: number,
): number {
  const [min, max] = range
  const target = Math.min(Math.max(current, min), max)
  if (current === target) return current
  const next = current + (target - current) * t
  return Math.abs(target - next) < 1e-5 ? target : next
}

/**
 * Per-stage camera position/target, applied instantly (no transition yet — that
 * arrives with Task 10's stage-advance animation). Distances grow slightly with each
 * stage so the larger shapes stay comfortably framed.
 *
 * Stage 1 (line) uses a straight-on, dead-center framing (looking straight down -z at
 * the line, which lies along x) rather than the oblique 3/4 angle Stages 3+ use —
 * combined with a zero-width `azimuthRange`/`polarRange` (Task 23; previously no
 * buttons at all), this is what makes it read as "this is all there is" rather than
 * "an object floating in a 3D scene I just haven't rotated yet." That works here
 * because "leaving the line" only needs *some* y (or z) component, and a dead-on-z
 * camera's drag plane still lets y vary freely.
 *
 * Stage 2 (plane) moved to the same dead-on, straight-ahead treatment as Stage 1 in
 * Task 17, once mouse-drag orbit stopped existing anywhere: a truly dead-on-z camera
 * makes z (the axis "leaving the plane" needs) mathematically unreachable by any 2D
 * mouse drag *at that exact angle*, since `dragPlane.ts`'s camera-facing drag surface
 * would then be the z=0 plane itself — but the player now has on-screen buttons
 * (Task 17: within `PLANE_TILT_RANGE`, resistance-free; Task 23: still nudgeable, with
 * resistance, past it) to tilt away from dead-on before dragging, which is what makes
 * z reachable again without giving up the flat resting view. See PROGRESS.md's Task 16
 * and Task 17 notes for the tension this replaces and how Task 17 resolves it.
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

/**
 * Stage 1 and 2's shared dead-on resting orientation, in `camera-controls`' own
 * azimuth/polar convention — both stages' `position`/`target` pairs differ only by a
 * pure +z offset from their target (see `shapePositions.ts`), which is azimuth 0,
 * polar pi/2 under this library's convention (confirmed directly by
 * `e2e/orbit.spec.ts`'s Stage 2 rest-state assertion). Used to build both stages'
 * zero/limited-width `azimuthRange`/`polarRange` below without repeating the literal
 * `Math.PI / 2` at each call site.
 */
const DEAD_ON_AZIMUTH = 0
const DEAD_ON_POLAR = Math.PI / 2

export const CAMERA_FRAMING: Record<Stage, CameraFraming> = {
  line: {
    position: [1.5, 0, 5],
    target: [1.5, 0, 0],
    azimuthRange: [DEAD_ON_AZIMUTH, DEAD_ON_AZIMUTH],
    polarRange: [DEAD_ON_POLAR, DEAD_ON_POLAR],
  },
  plane: {
    position: [1.5, 1.5, 5],
    target: [1.5, 1.5, 0],
    azimuthRange: [DEAD_ON_AZIMUTH - PLANE_TILT_RANGE, DEAD_ON_AZIMUTH + PLANE_TILT_RANGE],
    polarRange: [DEAD_ON_POLAR - PLANE_TILT_RANGE, DEAD_ON_POLAR + PLANE_TILT_RANGE],
  },
  cube: {
    position: [4.75, 4.75, 5.75],
    target: [1.25, 1.25, 1.25],
    azimuthRange: FULL_AZIMUTH_RANGE,
    polarRange: FULL_POLAR_RANGE,
  },
  reveal: {
    position: [4, 3.5, 5],
    target: [0, 0, 0],
    azimuthRange: FULL_AZIMUTH_RANGE,
    polarRange: FULL_POLAR_RANGE,
  },
  closing: {
    position: [4, 3.5, 5],
    target: [0, 0, 0],
    azimuthRange: FULL_AZIMUTH_RANGE,
    polarRange: FULL_POLAR_RANGE,
  },
}

/**
 * Post-Task-25 playtest feedback: `CAMERA_FRAMING`'s `position`/`target` above are
 * fixed values matching the pre-existing positive-octant shapes — kept exactly as-is
 * (still used directly for `azimuthRange`/`polarRange`, which never depend on
 * `axisSign` — see `state/stageConfig.ts`'s `AxisSign` doc comment for why: a camera's
 * *orientation* relative to its target is unaffected by which world-space octant that
 * target actually sits in). This function is the live, mirrored counterpart used for
 * the actual `position`/`target` a camera gets pointed at — `scene/Experience.tsx`'s
 * `CameraRig` and its initial `Canvas` camera prop are the only two callers.
 *
 * Each stage's camera *offset* from its target (not just the target itself) mirrors by
 * the same sign as that stage's shape — for the cube this keeps the camera on the same
 * "outside" side of the mirrored shape it always was (an unmirrored offset would leave
 * the camera framing the shape from across the origin, looking the wrong way in). The
 * dead-on stages' (line/plane) offset is pure `+z` with no `y` component to begin with,
 * so mirroring `y` there is a no-op — confirmed by `e2e/orbit.spec.ts`'s existing
 * dead-on rest-state assertion, which this function reproduces exactly at the default
 * `axisSign = { y: 1, z: 1 }`.
 */
export function cameraPositionTarget(
  stage: Stage,
  axisSign: AxisSign,
): Pick<CameraFraming, 'position' | 'target'> {
  switch (stage) {
    case 'line':
      return { position: [LINE_POSITION[0], LINE_POSITION[1], LINE_POSITION[2] + 5], target: LINE_POSITION }
    case 'plane': {
      const target = planePosition(axisSign)
      return { position: [target[0], target[1], target[2] + 5], target }
    }
    case 'cube': {
      const target = cubePosition(axisSign)
      const position: readonly [number, number, number] = [
        target[0] + 3.5,
        target[1] + 3.5 * axisSign.y,
        target[2] + 4.5 * axisSign.z,
      ]
      return { position, target }
    }
    case 'reveal':
    case 'closing':
      return { position: CAMERA_FRAMING[stage].position, target: CAMERA_FRAMING[stage].target }
  }
}
