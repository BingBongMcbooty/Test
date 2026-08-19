import { create } from 'zustand'
import type { AttemptResult } from '../math/validation'
import { REVEAL_SLICE_RANGE, type RevealView, type Stage, nextStage } from './stageConfig'

interface DimensionsState {
  stage: Stage
  attempts: number
  isDrawing: boolean
  lastResult: AttemptResult | null
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

  setStage: (stage: Stage) => void
  advanceStage: () => void
  startDrawing: () => void
  endDrawing: () => void
  recordAttempt: (result: AttemptResult) => void
  toggleRevealView: () => void
  rotateRevealXW: (deltaAngle: number) => void
  rotateRevealYW: (deltaAngle: number) => void
  adjustRevealSlice: (delta: number) => void
  reset: () => void
}

const initialState = {
  stage: 'line' as Stage,
  attempts: 0,
  isDrawing: false,
  lastResult: null as AttemptResult | null,
  revealView: 'slice' as RevealView,
  revealRotationXW: 0,
  revealRotationYW: 0,
  revealSliceW0: 0,
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export const useDimensionsStore = create<DimensionsState>((set) => ({
  ...initialState,

  setStage: (stage) => set({ stage, attempts: 0, isDrawing: false, lastResult: null }),

  advanceStage: () =>
    set((state) => ({
      stage: nextStage(state.stage),
      attempts: 0,
      isDrawing: false,
      lastResult: null,
    })),

  startDrawing: () => set({ isDrawing: true }),

  endDrawing: () => set({ isDrawing: false }),

  recordAttempt: (result) =>
    set((state) => ({
      lastResult: result,
      attempts: state.attempts + 1,
      isDrawing: false,
    })),

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
