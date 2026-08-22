import { create } from 'zustand'
import type { AttemptResult, Vec3 } from '../math/validation'
import {
  REVEAL_SLICE_RANGE,
  type RevealView,
  type Stage,
  nextRevealView,
  nextStage,
} from './stageConfig'

interface DimensionsState {
  stage: Stage
  attempts: number
  isDrawing: boolean
  lastResult: AttemptResult | null
  /**
   * Task 15: the live drag vector, for `ui/DimensionPanel.tsx`'s readout. The drag
   * itself still lives in `ArrowDrag.tsx`'s local component state per the Task 3/10
   * locked decision (per-drag state stays local, not in the store) — this one field is
   * the deliberate, narrow exception PLAN.md's Task 15 section calls for, mirroring
   * `isDrawing`'s own boundary-crossing lifecycle exactly rather than lifting the whole
   * drag: set on every pointer-move during a drag, cleared to null on pointer-up (same
   * as `ArrowDrag.tsx`'s local `liveDrag`) and on stage change (see `setStage`/
   * `advanceStage`/`reset` below). Null is what tells the panel to show no row at all —
   * either nothing has been attempted yet this stage, or nothing is being dragged right
   * now; either way there's no live number to show. (An earlier version of this field
   * stayed populated after release so the panel could show the last attempt's numbers
   * at rest — reverted because the panel's text sits inside the same screen region
   * `e2e/arrow-drag.spec.ts`/`validation-wiring.spec.ts`'s pixel-exact "back to at-rest"
   * assertions screenshot, and a lingering non-placeholder value broke those.)
   */
  liveDragVector: Vec3 | null
  /**
   * Task 24: the live cursor position, continuously tracked on Stages 1-2 regardless
   * of whether a drag is happening — `scene/CursorTracker.tsx` raycasts every
   * `pointermove` onto the world z=0 plane the line/plane shape itself lies in and
   * writes the hit here, so `ui/DimensionPanel.tsx`'s x/y ledger (and Stage 1's
   * on-scene marker dot, `scene/CursorMarker.tsx`) never go blank at rest the way
   * `liveDragVector` above does — the whole point of this field is to be populated by
   * a plain hover, no click required. `z` is always 0 here (the raycast target plane),
   * kept only so this shares `Vec3`'s shape rather than inventing a 2-tuple type. Null
   * whenever the stage isn't line/plane (Stage 3 uses `trackedCubeVertexCamera` below
   * instead) or the pointer hasn't moved yet this stage.
   */
  liveCursorPoint: Vec3 | null
  /**
   * Task 24: Stage 3's tracked-cube-vertex readout, expressed in the *camera's* own
   * view frame rather than world space — confirmed directly by the user (this
   * session's environment didn't have `AskUserQuestion` available, so the question and
   * answer happened via the coordinator relaying it — see PROGRESS.md) after PLAN.md
   * flagged this as needing a real decision rather than a guess: the cube itself never
   * rotates in world space, only the camera orbits around it (Task 17's D-pad), so
   * `TRACKED_CUBE_VERTEX_WORLD`'s raw coordinates never change on their own —
   * recomputing it relative to the camera every frame
   * (`scene/TrackedCubeVertexTracker.tsx`, `math/cameraRelative.ts`) is what makes
   * this readout visibly change as the player orbits, mirroring how the tesseract's
   * own tracked vertex changes under a real 4D rotation in Stage 4. Null whenever the
   * stage isn't cube, or before the camera has rendered a first frame.
   */
  trackedCubeVertexCamera: Vec3 | null
  /**
   * Task 18: Stages 1-2 no longer advance the instant a drag passes — `ArrowDrag.tsx`
   * sets this (via `markStagePassed`) on the first passing drag this stage instead of
   * calling `advanceStage()` directly, and `ui/StageContinue.tsx` shows a manual
   * "Continue" button once it's true. Deliberately untouched by `recordAttempt` — a
   * later failed attempt on the same stage (the player exploring further, per the "no
   * artificial lock" locked decision) must not un-pass it and hide the button. Reset to
   * `false` alongside the other per-stage fields on `setStage`/`advanceStage`/`reset`.
   */
  stagePassed: boolean
  revealView: RevealView
  /**
   * xw-plane rotation angle (radians) — the default drag rotation, see RevealDrag.tsx.
   * Rotating only in this one plane keeps the slice hyperplane's normal confined to x,
   * which leaves y/z totally unconstrained by the slice (always a full-extent box) —
   * see `revealRotationYW`, which is what actually breaks that degeneracy.
   */
  revealRotationXW: number
  /** yw-plane rotation angle (radians) — the Shift+drag rotation, see RevealDrag.tsx. */
  revealRotationYW: number
  /** Stage 4's hyperplane slice offset, clamped to +-REVEAL_SLICE_RANGE. */
  revealSliceW0: number
  /**
   * Task 20: whether the 3D slicing warm-up (`scene/SliceWarmup.tsx`) is showing instead
   * of the tesseract itself. Only ever set `true` by `advanceStage()` landing on
   * `'reveal'` — real gameplay progression from the cube stage — not by `setStage`,
   * which `ui/DebugStageControls.tsx` and every pre-existing reveal-stage Playwright
   * test use to jump straight to the tesseract for testing convenience; leaving those
   * untouched by this task means none of them needed updating. `finishRevealWarmup`
   * (called by the warm-up's own skip button, or once the player's played with it a
   * bit) is the only way back to `false` short of a stage change.
   */
  revealWarmupActive: boolean
  /**
   * Task 25: non-null exactly while the Stage 1->2 or 2->3 growth animation
   * (`scene/StageGrowthTransition.tsx`) is playing — `{ from, to }` names the two
   * stages the animation is extruding between (`to` always equals the just-set `stage`
   * below; kept as its own field rather than derived so `math/growth.ts`'s
   * `GROWTH_MAX_CORNER[from]`/`[to]` lookups read directly off this one value).
   * `advanceStage()` is the only setter that ever populates this, and only for the two
   * edges that structurally extend the previous shape by one axis — every other
   * transition (including cube->reveal, deliberately: see PLAN.md's "why a growth
   * animation... and why not across the Stage 3->4 boundary") leaves it `null`, which
   * is what `scene/Experience.tsx`'s `StageGeometry` reads to decide whether to render
   * the destination stage's normal static shape immediately (as it always has) or let
   * `StageGrowthTransition` animate into it first. `setStage()` (the debug jump used
   * throughout the existing Playwright suite and `ui/DebugStageControls.tsx`) always
   * clears it to `null` rather than ever setting it — jumping stages for
   * testing/navigation convenience was never meant to play the narrative growth beat,
   * mirroring `revealWarmupActive`'s own "only real progression triggers this" rule.
   * Cleared by `finishGrowthTransition()`, called by `StageGrowthTransition` itself once
   * its animation timer completes.
   */
  growthTransition: { from: Stage; to: Stage } | null

  setStage: (stage: Stage) => void
  advanceStage: () => void
  startDrawing: () => void
  endDrawing: () => void
  recordAttempt: (result: AttemptResult) => void
  markStagePassed: () => void
  setLiveDragVector: (vector: Vec3 | null) => void
  setLiveCursorPoint: (point: Vec3 | null) => void
  setTrackedCubeVertexCamera: (point: Vec3 | null) => void
  toggleRevealView: () => void
  rotateRevealXW: (deltaAngle: number) => void
  rotateRevealYW: (deltaAngle: number) => void
  adjustRevealSlice: (delta: number) => void
  finishRevealWarmup: () => void
  finishGrowthTransition: () => void
  reset: () => void
}

const initialState = {
  stage: 'line' as Stage,
  attempts: 0,
  isDrawing: false,
  lastResult: null as AttemptResult | null,
  liveDragVector: null as Vec3 | null,
  liveCursorPoint: null as Vec3 | null,
  trackedCubeVertexCamera: null as Vec3 | null,
  stagePassed: false,
  revealView: 'slice' as RevealView,
  revealRotationXW: 0,
  revealRotationYW: 0,
  revealSliceW0: 0,
  revealWarmupActive: false,
  growthTransition: null as { from: Stage; to: Stage } | null,
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export const useDimensionsStore = create<DimensionsState>((set) => ({
  ...initialState,

  setStage: (stage) =>
    set({
      stage,
      attempts: 0,
      isDrawing: false,
      lastResult: null,
      liveDragVector: null,
      liveCursorPoint: null,
      trackedCubeVertexCamera: null,
      stagePassed: false,
      revealWarmupActive: false,
      growthTransition: null,
    }),

  advanceStage: () =>
    set((state) => {
      const stage = nextStage(state.stage)
      // Task 25: only these two edges structurally extend the previous shape by one
      // axis — cube->reveal (and line/plane/cube's own no-op self-advance at the very
      // end of STAGE_ORDER) deliberately never populates this. See this field's own
      // doc comment above for why.
      const isGrowthEdge =
        (state.stage === 'line' && stage === 'plane') ||
        (state.stage === 'plane' && stage === 'cube')
      return {
        stage,
        attempts: 0,
        isDrawing: false,
        lastResult: null,
        liveDragVector: null,
        liveCursorPoint: null,
        trackedCubeVertexCamera: null,
        stagePassed: false,
        revealWarmupActive: stage === 'reveal',
        growthTransition: isGrowthEdge ? { from: state.stage, to: stage } : null,
      }
    }),

  startDrawing: () => set({ isDrawing: true }),

  endDrawing: () => set({ isDrawing: false }),

  recordAttempt: (result) =>
    set((state) => ({
      lastResult: result,
      attempts: state.attempts + 1,
      isDrawing: false,
    })),

  markStagePassed: () => set({ stagePassed: true }),

  setLiveDragVector: (vector) => set({ liveDragVector: vector }),

  setLiveCursorPoint: (point) => set({ liveCursorPoint: point }),

  setTrackedCubeVertexCamera: (point) => set({ trackedCubeVertexCamera: point }),

  // Task 21: cycles slice -> projection -> chirality -> slice, rather than a binary flip
  // — see `stageConfig.ts`'s `REVEAL_VIEW_ORDER`/`nextRevealView`.
  toggleRevealView: () => set((state) => ({ revealView: nextRevealView(state.revealView) })),

  rotateRevealXW: (deltaAngle) =>
    set((state) => ({ revealRotationXW: state.revealRotationXW + deltaAngle })),

  rotateRevealYW: (deltaAngle) =>
    set((state) => ({ revealRotationYW: state.revealRotationYW + deltaAngle })),

  adjustRevealSlice: (delta) =>
    set((state) => ({
      revealSliceW0: clamp(state.revealSliceW0 + delta, -REVEAL_SLICE_RANGE, REVEAL_SLICE_RANGE),
    })),

  finishRevealWarmup: () => set({ revealWarmupActive: false }),

  finishGrowthTransition: () => set({ growthTransition: null }),

  reset: () => set({ ...initialState }),
}))

// Dev-only escape hatch so e2e tests can read exact store state (e.g. confirming
// revealRotation/revealSliceW0 genuinely hold still with no pointer input, or that
// toggling revealView leaves them untouched) instead of inferring it from animated-
// shader canvas pixels — RevealStage's material intentionally never sits still (Task
// 7's visual escalation), which makes screenshot-diff magnitude an unreliable proxy for
// "did the underlying 4D state change." `import.meta.env.DEV` is statically false in
// `vite build`, so this is dead code eliminated from the shipped bundle — same spirit as
// `DebugStageControls.tsx`'s test-support scaffolding, just for state instead of stage
// navigation.
if (import.meta.env.DEV) {
  Object.assign(window, { __dimensionsStore: useDimensionsStore })
}
