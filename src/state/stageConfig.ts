export type Stage = 'line' | 'plane' | 'cube' | 'reveal' | 'closing'

export type Axis = 'x' | 'y' | 'z'

/** Stage 4's two ways of rendering the same underlying 4D state — see RevealStage.tsx. */
export type RevealView = 'slice' | 'projection'

export interface StageConfig {
  /** axes already spanned by the shape at this stage — the subspace a drag gets validated against */
  occupiedAxes: readonly Axis[]
  prompt: string
}

export const STAGE_ORDER: readonly Stage[] = ['line', 'plane', 'cube', 'reveal', 'closing']

export const STAGE_CONFIG: Record<Stage, StageConfig> = {
  line: {
    occupiedAxes: ['x'],
    prompt: 'Draw a line that leaves this line.',
  },
  plane: {
    occupiedAxes: ['x', 'y'],
    prompt: 'Draw a line that leaves this plane.',
  },
  cube: {
    occupiedAxes: ['x', 'y', 'z'],
    prompt: 'Draw a line that leaves this cube.',
  },
  reveal: {
    occupiedAxes: ['x', 'y', 'z'],
    prompt:
      'Every direction you tried was already here. There is a 4th — you just can’t point at it.',
  },
  closing: {
    occupiedAxes: ['x', 'y', 'z'],
    prompt: 'The wall you just hit repeats at every dimension.',
  },
}

/**
 * Vertex/edge counts for Stages 1-3's shapes, for `ui/DimensionPanel.tsx` (Task 15) to
 * show the doubling pattern (`n`-cube: 2^n vertices, n*2^(n-1) edges) building up one
 * dimension at a time — 1,4,12 edges is PLAN.md's own example. `null` for stages whose
 * shape isn't a hypercube slice in this sense (reveal/closing) — Task 16 extends the
 * panel with the tesseract's own counts (16 vertices, 32 edges) there.
 */
export const STAGE_SHAPE_COUNTS: Record<Stage, { vertices: number; edges: number } | null> = {
  line: { vertices: 2, edges: 1 },
  plane: { vertices: 4, edges: 4 },
  cube: { vertices: 8, edges: 12 },
  reveal: null,
  closing: null,
}

/**
 * Stage 3 always fails `evaluateAttempt` (its occupiedAxes is all of x/y/z, so the
 * leftover is structurally the zero vector — see validation.ts) — this is the count of
 * such attempts before the app moves the player on to `reveal` regardless. PLAN.md's
 * tunable, "start with N=3."
 */
export const CUBE_ATTEMPTS_BEFORE_REVEAL = 3

/**
 * Clamp range for Stage 4's slice offset (`revealSliceW0`), in the same units as
 * `math/fourd.ts`'s w-coordinate. A rotated tesseract's w-extent tops out at +-sqrt(2)
 * (Task 13's note), so +-1.5 comfortably covers the whole range including where the
 * cross-section shrinks to nothing, without letting the player drag indefinitely into
 * empty space.
 */
export const REVEAL_SLICE_RANGE = 1.5

export function nextStage(stage: Stage): Stage {
  const index = STAGE_ORDER.indexOf(stage)
  return STAGE_ORDER[Math.min(index + 1, STAGE_ORDER.length - 1)]
}
