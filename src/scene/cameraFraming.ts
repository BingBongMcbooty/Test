import type { Stage } from '../state/stageConfig'

export interface CameraFraming {
  position: readonly [number, number, number]
  target: readonly [number, number, number]
  /**
   * Whether `CameraControls`' own drag-to-orbit is available at this stage. Stages 1-2
   * are locked (`false`): the whole point of "a line is a 1D world" / "a plane is a 2D
   * world" collapses if the player can drag the screen and watch it turn out to be an
   * object sitting in 3D space after all — see PROGRESS.md's post-Task-15 design pivot
   * note. Orbit only unlocks at Stage 3 (cube), which is genuinely 3D.
   */
  orbitEnabled: boolean
}

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
 * Stage 2 (plane) keeps its original oblique angle (unlike line) even though
 * `orbitEnabled: false` here too — a truly dead-on-z camera would make z (the axis
 * "leaving the plane" needs) mathematically unreachable by any 2D mouse drag at all,
 * since `dragPlane.ts`'s camera-facing drag surface would then *be* the z=0 plane
 * itself. See PROGRESS.md's post-Task-15 design-pivot note for the tension this left
 * unresolved: this framing is locked (no orbit) but still visibly oblique/3D-looking,
 * which only partially satisfies "a plane is a 2D world."
 */
export const CAMERA_FRAMING: Record<Stage, CameraFraming> = {
  line: { position: [0, 0, 5], target: [0, 0, 0], orbitEnabled: false },
  plane: { position: [3.5, 3, 4.5], target: [0, 0, 0], orbitEnabled: false },
  cube: { position: [3.5, 3.5, 4.5], target: [0, 0, 0], orbitEnabled: true },
  reveal: { position: [4, 3.5, 5], target: [0, 0, 0], orbitEnabled: true },
  closing: { position: [4, 3.5, 5], target: [0, 0, 0], orbitEnabled: true },
}
