/**
 * Task 25: shared math for the Stage 1->2 / 2->3 growth-transition animation
 * (`scene/StageGrowthTransition.tsx`) — one small utility rather than bespoke code at
 * each boundary, since both transitions are the same underlying idea: the existing
 * shape's flat outline extrudes one further axis to become the next stage's shape.
 *
 * Every one of Stages 1-3's shapes (`scene/shapePositions.ts`, positioned into the
 * positive octant by Task 16) shares one corner pinned at the world origin, so an
 * axis-aligned box with `min = (0,0,0)` and a per-stage `max` corner exactly describes
 * all three: the line degenerates to a box with two zero-length sides
 * (`max = (3,0,0)`), the plane to one zero-length side (`max = (3,3,0)`), and the cube
 * is a real box (`max = (2.5,2.5,2.5)`). Interpolating just the `max` corner between
 * two stages' own values, then drawing that box's 12-edge wireframe every frame, is
 * what makes one function serve both the 1->2 "sweep out a perpendicular edge"
 * transition and the 2->3 "extrude into a cube" transition without a special case for
 * either — the degenerate start/end shapes fall out of the same box-wireframe logic
 * automatically, and the 2->3 transition's incidental base resize (the plane's 3x3
 * outline settling down to the cube's 2.5x2.5 footprint) reads as part of the same
 * continuous grow/extrude motion rather than a separate step.
 *
 * `GROWTH_MAX_CORNER`'s values are read off `scene/stages/LineStage.tsx` (a length-3
 * segment), `PlaneStage.tsx` (`PlaneGeometry(3, 3)`), and `CubeStage.tsx`
 * (`BoxGeometry(2.5, 2.5, 2.5)`) rather than imported from one shared constant —
 * deliberately duplicated, not refactored out of those already-shipped, already-tested
 * files, to keep this task's change footprint to new files plus the store/HUD/
 * scene-router wiring needed to play the animation. If any of those three geometries'
 * sizes ever change, update the matching entry below to match.
 */

export type Corner = readonly [number, number, number]

/** Componentwise linear interpolation between two corner points. */
export function lerpCorner(from: Corner, to: Corner, t: number): Corner {
  return [
    from[0] + (to[0] - from[0]) * t,
    from[1] + (to[1] - from[1]) * t,
    from[2] + (to[2] - from[2]) * t,
  ]
}

/**
 * Clamped smoothstep (`3t²-2t³`) — eases in, moves fastest through the middle, eases
 * out. A first pass used a cubic ease-*out* (fast start, gentle settle) instead, on the
 * assumption that would read as something actively extending itself — checked by eye
 * against real screenshots (see PROGRESS.md), and it backfired: ease-out is so heavily
 * front-loaded that the shape reads as "basically already grown" by roughly a third of
 * the way through the duration, with only an imperceptible sliver left to visibly
 * creep afterward — closer to an instant pop-in with a slow tail than a growth the
 * player can actually watch happen. Smoothstep keeps visible motion spread across
 * (almost) the whole duration instead, which is what a "watch this sweep/extrude"
 * animation actually needs.
 */
export function easeGrowth(t: number): number {
  const clamped = Math.min(1, Math.max(0, t))
  return clamped * clamped * (3 - 2 * clamped)
}

/**
 * "Back" ease-out (overshoot) — a flashier alternative to `easeGrowth` above, used for
 * the growth transition's actual geometry (`StageGrowthTransition.tsx`) after direct
 * user feedback that the plain smoothstep version, even slowed to `GROWTH_DURATION`'s
 * 2.5s, still read as too quiet: "not seamless enough… they should feel flashy." Eases
 * in, overshoots the destination corner by roughly 10% partway through, then springs
 * back to settle exactly at 1 — the shape visibly grows slightly past its final size
 * and bounces back, instead of smoothstep's purely monotonic glide to a stop. Standard
 * "easeOutBack" constants (`c1 = 1.70158`, `c3 = c1 + 1`).
 *
 * Deliberately a new function rather than a change to `easeGrowth`: Task 25's own notes
 * already document a real regression from a *different* kind of alternate curve (a
 * front-loaded ease-out that made the animation look already-finished a third of the
 * way through) — keeping both curves named and separate makes it easy to tell which one
 * is actually in use if a future playtest finds a problem with either.
 */
const BACK_C1 = 1.70158
const BACK_C3 = BACK_C1 + 1
export function easeGrowthFlashy(t: number): number {
  const clamped = Math.min(1, Math.max(0, t))
  const shifted = clamped - 1
  return 1 + BACK_C3 * shifted ** 3 + BACK_C1 * shifted ** 2
}

/**
 * 0 -> 1 -> 0 parabola, peaking exactly at the animation's midpoint — drives the growth
 * transition's color-flash pulse (`StageGrowthTransition.tsx`): the wireframe's color
 * lerps from its resting tone toward a bright accent as this rises, then back to resting
 * as it falls, timed off the same linear (not overshoot-eased) progress ratio the
 * geometry's `easeGrowthFlashy` input already uses, rather than a second independent clock.
 */
export function growthFlashIntensity(t: number): number {
  const clamped = Math.min(1, Math.max(0, t))
  return 4 * clamped * (1 - clamped)
}

/** The wireframe's resting color, outside of a flash pulse — Task 25's original choice. */
export const GROWTH_REST_COLOR = '#e5e4e7'

/** The bright accent color a growth transition's color-flash pulse lerps toward. */
export const GROWTH_FLASH_COLOR = '#ffe9b3'

/** Always exactly 12 — see `boxWireframeEdges`'s doc comment for why this never varies. */
export const GROWTH_EDGE_COUNT = 12

/**
 * The 12 edges of an axis-aligned box with one corner at the world origin and the
 * opposite corner at `max`, as an array of `[start, end]` point pairs — always exactly
 * `GROWTH_EDGE_COUNT` entries, even when `max` has a zero component, so a
 * `BufferGeometry` built from this never has to resize its attribute over the course
 * of an animation. A zero component degenerates 4 of the 12 edges to zero-length
 * segments (harmless — they simply don't render) and collapses the remaining 8 into
 * the 4-edge outline of a flat rectangle: at `max = (3,0,0)` this is exactly Stage 1's
 * line, at `max = (3,3,0)` exactly Stage 2's square outline, at `max = (2.5,2.5,2.5)` a
 * full 12-edge cube — matching `state/stageConfig.ts`'s `STAGE_SHAPE_COUNTS` edge
 * counts (1, 4, 12) exactly, which is what makes this one function double as both the
 * animation's in-between frames and its exact start/end poses.
 */
export function boxWireframeEdges(max: Corner): readonly (readonly [Corner, Corner])[] {
  const [x, y, z] = max
  const o: Corner = [0, 0, 0]
  const cx: Corner = [x, 0, 0]
  const cy: Corner = [0, y, 0]
  const cz: Corner = [0, 0, z]
  const cxy: Corner = [x, y, 0]
  const cxz: Corner = [x, 0, z]
  const cyz: Corner = [0, y, z]
  const cxyz: Corner = [x, y, z]

  return [
    // bottom face (z = 0)
    [o, cx],
    [o, cy],
    [cx, cxy],
    [cy, cxy],
    // top face (z = max z)
    [cz, cxz],
    [cz, cyz],
    [cxz, cxyz],
    [cyz, cxyz],
    // the 4 verticals connecting the two faces
    [o, cz],
    [cx, cxz],
    [cy, cyz],
    [cxy, cxyz],
  ]
}

/**
 * Duration of the growth animation, in seconds — tuned by eye (see PROGRESS.md).
 * Originally 0.6s; raised to 2.5s after direct user feedback that the shorter duration
 * read as an abrupt pop rather than a shape actually growing — at 2.5s `easeGrowth`'s
 * smoothstep has enough real time to spread the sweep/extrude motion across, so a
 * viewer can actually watch each edge move instead of catching only the eased-in start
 * and eased-out end of a near-instant snap.
 */
export const GROWTH_DURATION = 2.5

/**
 * Caps how much of `GROWTH_DURATION` a single animation frame can ever advance
 * (`scene/StageGrowthTransition.tsx` clamps `useFrame`'s real `delta` to this before
 * accumulating it) — standard "delta clamping" for real-time animation, guarding
 * against the frame-rate equivalent of a spiral of death: without it, one unusually
 * large frame (a backgrounded-then-refocused tab, or several headless browsers
 * contending for CPU during a full Playwright run — confirmed as a real, reproducible
 * source of full-suite flakiness in this sandbox, not just a hypothetical) could
 * silently swallow the *entire* growth duration in a single tick, making the animation
 * appear to teleport straight to its end state instead of actually playing. At
 * `GROWTH_DURATION = 2.5`, this guarantees at least `2.5 / 0.05 = 50` real frames
 * always render before the animation can finish, no matter how stalled any individual
 * frame's real wall-clock delta was.
 */
export const GROWTH_MAX_FRAME_DELTA = 0.05

/**
 * Per-stage `max` corner (world space; `min` is always the origin — see the module doc
 * comment) for the two stages that ever appear as either end of a growth transition.
 * 'reveal'/'closing' never appear here — the cube->reveal boundary deliberately gets no
 * growth animation at all (see `state/store.ts`'s `advanceStage`, and PLAN.md's "why a
 * growth animation... and why not across the Stage 3->4 boundary" rationale).
 */
export const GROWTH_MAX_CORNER: Record<'line' | 'plane' | 'cube', Corner> = {
  line: [3, 0, 0],
  plane: [3, 3, 0],
  cube: [2.5, 2.5, 2.5],
}

/**
 * Post-Task-25 playtest feedback: `GROWTH_MAX_CORNER` above always grows +y then +z,
 * which "invalidates the meaning of the arrow's direction" when a player legitimately
 * passes by dragging -y or -z instead (`evaluateAttempt` never looks at sign — only the
 * orthogonal-leftover ratio does). This applies `axisSign` (recorded by `ArrowDrag.tsx`
 * from the real passing drag, via `discoveredAxisSign` below) to `GROWTH_MAX_CORNER`'s
 * canonical positive values, so the growth geometry sweeps toward whichever sign the
 * player actually demonstrated. `boxWireframeEdges` (above) already handles a negative
 * `max` component correctly with no changes of its own — it only ever draws a box from
 * the origin to `max`, and a negative component is just a box extending the other way.
 */
export function signedGrowthMaxCorner(
  stage: 'line' | 'plane' | 'cube',
  axisSign: { y: 1 | -1; z: 1 | -1 },
): Corner {
  const [x, y, z] = GROWTH_MAX_CORNER[stage]
  // `+ 0` normalizes a `0 * -1` result back to positive `0` (IEEE-754 addition, unlike
  // multiplication, does this for free) — a zero component (line's y/z, plane's z)
  // otherwise silently becomes `-0`, which is numerically harmless everywhere this
  // feeds into (rendering, `lerpCorner`) but trips exact `toEqual` comparisons in tests.
  return [x, (y * axisSign.y) + 0, (z * axisSign.z) + 0]
}

/**
 * Which unoccupied axis a passing drag's leftover was actually dominant in, and its
 * sign — `ArrowDrag.tsx` calls this on every passing Stage 1/2 drag and feeds the
 * result to `state/store.ts`'s `recordAxisDiscovery`. Only `y`/`z` can ever come back:
 * `x` is occupied at every stage that can pass (line/plane both keep it occupied), so
 * it's never a candidate. Picks the *largest-magnitude* unoccupied component rather
 * than assuming a fixed axis, so this stays correct even though in practice Stage 1's
 * dead-on camera (see `cameraFraming.ts`) makes z's leftover component negligible and
 * Stage 2's occupied axes leave only z as a candidate at all — the dominant-component
 * selection is what "approximated to a right angle" means here: whichever single axis
 * the drag was mostly pointing along wins, not some blend of more than one. Returns
 * `null` for a totally zero leftover (shouldn't happen for a drag that already passed
 * `ORTHOGONALITY_THRESHOLD`, but a defensive fallback rather than a crash). Takes the
 * raw drag vector rather than an already-projected leftover — `projectOntoComplement`
 * only zeroes the *occupied* components, so for the unoccupied `y`/`z` candidates this
 * function actually reads, the raw vector and the leftover agree exactly; the caller
 * doesn't need to project first.
 */
export function discoveredAxisSign(
  dragVector: { x: number; y: number; z: number },
  occupiedAxes: readonly ('x' | 'y' | 'z')[],
): { axis: 'y' | 'z'; sign: 1 | -1 } | null {
  const candidates = (['y', 'z'] as const).filter((axis) => !occupiedAxes.includes(axis))
  let bestAxis: 'y' | 'z' | null = null
  let bestMagnitude = 0
  for (const axis of candidates) {
    const magnitude = Math.abs(dragVector[axis])
    if (magnitude > bestMagnitude) {
      bestMagnitude = magnitude
      bestAxis = axis
    }
  }
  if (!bestAxis) return null
  return { axis: bestAxis, sign: dragVector[bestAxis] >= 0 ? 1 : -1 }
}
