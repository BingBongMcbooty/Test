import { create } from 'zustand'
import type { AttemptResult, Vec3 } from '../math/validation'
import { REVEAL_SLICE_RANGE, type RevealView, type Stage, nextStage } from './stageConfig'

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

  setStage: (stage: Stage) => void
  advanceStage: () => void
  startDrawing: () => void
  endDrawing: () => void
  recordAttempt: (result: AttemptResult) => void
  markStagePassed: () => void
  setLiveDragVector: (vector: Vec3 | null) => void
  toggleRevealView: () => void
  rotateRevealXW: (deltaAngle: number) => void
  rotateRevealYW: (deltaAngle: number) => void
  adjustRevealSlice: (delta: number) => void
  finishRevealWarmup: () => void
  reset: () => void
}

const initialState = {
  stage: 'line' as Stage,
  attempts: 0,
  isDrawing: false,
  lastResult: null as AttemptResult | null,
  liveDragVector: null as Vec3 | null,
  stagePassed: false,
  revealView: 'slice' as RevealView,
  revealRotationXW: 0,
  revealRotationYW: 0,
  revealSliceW0: 0,
  revealWarmupActive: false,
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
      stagePassed: false,
      revealWarmupActive: false,
    }),

  advanceStage: () =>
    set((state) => {
      const stage = nextStage(state.stage)
      return {
        stage,
        attempts: 0,
        isDrawing: false,
        lastResult: null,
        liveDragVector: null,
        stagePassed: false,
        revealWarmupActive: stage === 'reveal',
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

  toggleRevealView: () =>
    set((state) => ({ revealView: state.revealView === 'slice' ? 'projection' : 'slice' })),

  rotateRevealXW: (deltaAngle) =>
    set((state) => ({ revealRotationXW: state.revealRotationXW + deltaAngle })),

  rotateRevealYW: (deltaAngle) =>
    set((state) => ({ revealRotationYW: state.revealRotationYW + deltaAngle })),

  adjustRevealSlice: (delta) =>
    set((state) => ({
      revealSliceW0: clamp(state.revealSliceW0 + delta, -REVEAL_SLICE_RANGE, REVEAL_SLICE_RANGE),
    })),

  finishRevealWarmup: () => set({ revealWarmupActive: false }),

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
