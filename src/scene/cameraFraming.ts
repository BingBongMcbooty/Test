import type { Stage } from '../state/stageConfig'

export interface CameraFraming {
  position: readonly [number, number, number]
  target: readonly [number, number, number]
}

/**
 * Per-stage camera position/target, applied instantly (no transition yet — that
 * arrives with Task 10's stage-advance animation). Distances grow slightly with each
 * stage so the larger shapes stay comfortably framed.
 */
export const CAMERA_FRAMING: Record<Stage, CameraFraming> = {
  line: { position: [3.5, 2, 4], target: [0, 0, 0] },
  plane: { position: [3.5, 3, 4.5], target: [0, 0, 0] },
  cube: { position: [3.5, 3.5, 4.5], target: [0, 0, 0] },
  reveal: { position: [4, 3.5, 5], target: [0, 0, 0] },
  closing: { position: [4, 3.5, 5], target: [0, 0, 0] },
}
