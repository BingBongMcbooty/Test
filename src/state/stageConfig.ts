export type Stage = 'line' | 'plane' | 'cube' | 'reveal' | 'closing'

export type Axis = 'x' | 'y' | 'z'

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
    prompt: 'Every direction you tried was already here. There is a 4th — you just can’t point at it.',
  },
  closing: {
    occupiedAxes: ['x', 'y', 'z'],
    prompt: 'The wall you just hit repeats at every dimension.',
  },
}

export function nextStage(stage: Stage): Stage {
  const index = STAGE_ORDER.indexOf(stage)
  return STAGE_ORDER[Math.min(index + 1, STAGE_ORDER.length - 1)]
}
