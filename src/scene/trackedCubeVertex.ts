import { Vector3 } from 'three'
import type { AxisSign } from '../state/stageConfig'
import { cubePosition } from './shapePositions'

/**
 * Task 24: which cube corner Stage 3's tracked-vertex readout follows — the same "one
 * specific point, live coordinates" concept Task 19 already established for the
 * tesseract (`scene/trackedVertex.ts`), introduced one dimension earlier so the player
 * has that mental model in hand before meeting it again in 4D. `CubeStage.tsx`'s
 * `BoxGeometry(2.5, 2.5, 2.5)` is centered on its own local origin (half-extent 1.25
 * each axis) before `cubePosition()` moves it into place — the corner picked here is
 * arbitrary (any corner demonstrates a live coordinate equally well, same reasoning as
 * Task 19's own pick), landing on the far corner from the room-corner origin the cube
 * sits in.
 *
 * Post-Task-25: takes `axisSign` and mirrors its own `+1.25` offset by the same sign as
 * `cubePosition()` did — otherwise, once the cube mirrors into a different octant, "the
 * far corner from the origin" would silently become "a corner *inside* the cube" on one
 * mirrored axis (adding a positive offset to an already-negative position moves back
 * toward zero, not further out).
 */
export function trackedCubeVertexWorld(axisSign: AxisSign): Vector3 {
  const [x, y, z] = cubePosition(axisSign)
  return new Vector3(x + 1.25, y + 1.25 * axisSign.y, z + 1.25 * axisSign.z)
}

/** Cyan — same as Task 19's tesseract tracked vertex (`trackedVertex.ts`), since it's the same concept. */
export { TRACKED_VERTEX_COLOR as TRACKED_CUBE_VERTEX_COLOR } from './trackedVertex'
