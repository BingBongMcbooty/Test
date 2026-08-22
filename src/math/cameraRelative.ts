import type { Camera, Vector3 } from 'three'

export interface Vec3Like {
  x: number
  y: number
  z: number
}

/**
 * Transforms a world-space point into `camera`'s own view frame (the coordinates the
 * point would have if the camera itself were the origin, looking down its own local
 * -z). Task 24: Stage 3's tracked-cube-vertex readout uses this — the cube never
 * rotates in world space, only the camera orbits around it (Task 17's D-pad), so a
 * vertex's *world* coordinates are constant forever; expressing it relative to the
 * camera instead is what makes the readout visibly change as the player orbits,
 * confirmed as the intended reading (not a constant world-space one) — see
 * PROGRESS.md's Task 24 notes for the exchange that settled this.
 *
 * A thin, pure wrapper around `Vector3.applyMatrix4` with the camera's own inverted
 * world matrix — mirrors `math/dragPlane.ts`'s "thin, testable wrapper around
 * three.js math" pattern, so it's unit-testable with a hand-built camera and no real
 * WebGL scene. Deliberately inverts `camera.matrixWorld` itself rather than reading
 * `camera.matrixWorldInverse` (a value three.js's renderer maintains, but only
 * refreshes during its own `render()` call) — recomputing it here means the result is
 * always correct for the camera's *current* transform, regardless of exactly when in
 * a frame this runs relative to the renderer's own render pass.
 */
export function toCameraRelative(worldPoint: Vector3, camera: Camera): Vec3Like {
  camera.updateMatrixWorld()
  const inverse = camera.matrixWorld.clone().invert()
  const local = worldPoint.clone().applyMatrix4(inverse)
  return { x: local.x, y: local.y, z: local.z }
}
