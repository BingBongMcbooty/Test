import type { AxisSign } from '../state/stageConfig'

/**
 * Task 16: each Stages 1-3 shape's translation from its old origin-centered position to
 * sitting fully within the positive octant, so it's actually enclosed by (rather than
 * half-poking through) that stage's new positive-octant-only coordinate grid — see
 * `Grid.tsx`. Every shape geometry itself is unchanged (still built centered at its own
 * local origin); this offset is applied as the mesh/group's world `position` instead, so
 * `cameraFraming.ts`'s position/target and `ArrowDrag.tsx`'s collider position can reuse
 * the exact same vector.
 *
 * Post-Task-25 playtest feedback: the plane/cube positions below now take `axisSign`
 * (`state/stageConfig.ts`) and mirror their `y`/`z` component to match, so the actual
 * rendered shape lands wherever the player's own passing drag demonstrated rather than
 * always the positive octant — see `state/stageConfig.ts`'s `AxisSign` doc comment for
 * the full rationale. `axisSign = { y: 1, z: 1 }` (the default, and what every debug
 * stage-jump resets to) reproduces the exact pre-existing positive-octant values, so
 * every already-shipped test that jumps stages directly is unaffected.
 */
export const LINE_POSITION: readonly [number, number, number] = [1.5, 0, 0]

export function planePosition(axisSign: AxisSign): readonly [number, number, number] {
  return [1.5, 1.5 * axisSign.y, 0]
}

export function cubePosition(axisSign: AxisSign): readonly [number, number, number] {
  return [1.25, 1.25 * axisSign.y, 1.25 * axisSign.z]
}
