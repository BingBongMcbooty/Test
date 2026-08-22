import { Vector3 } from 'three'
import { SHAPE_POSITION } from './shapePositions'

/**
 * Task 24: which cube corner Stage 3's tracked-vertex readout follows — the same "one
 * specific point, live coordinates" concept Task 19 already established for the
 * tesseract (`scene/trackedVertex.ts`), introduced one dimension earlier so the player
 * has that mental model in hand before meeting it again in 4D. `CubeStage.tsx`'s
 * `BoxGeometry(2.5, 2.5, 2.5)` is centered on its own local origin (half-extent 1.25
 * each axis) before `SHAPE_POSITION.cube` moves it into the positive octant — the
 * corner picked here is arbitrary (any corner demonstrates a live coordinate equally
 * well, same reasoning as Task 19's own pick), landing on the far corner from the
 * room-corner origin the cube sits in.
 */
export const TRACKED_CUBE_VERTEX_WORLD = new Vector3(
  SHAPE_POSITION.cube[0] + 1.25,
  SHAPE_POSITION.cube[1] + 1.25,
  SHAPE_POSITION.cube[2] + 1.25,
)

/** Cyan — same as Task 19's tesseract tracked vertex (`trackedVertex.ts`), since it's the same concept. */
export { TRACKED_VERTEX_COLOR as TRACKED_CUBE_VERTEX_COLOR } from './trackedVertex'
