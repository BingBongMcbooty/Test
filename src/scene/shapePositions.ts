/**
 * Task 16: each Stages 1-3 shape's translation from its old origin-centered position to
 * sitting fully within the positive octant, so it's actually enclosed by (rather than
 * half-poking through) that stage's new positive-octant-only coordinate grid — see
 * `Grid.tsx`. Every shape geometry itself is unchanged (still built centered at its own
 * local origin); this offset is applied as the mesh/group's world `position` instead, so
 * `cameraFraming.ts`'s position/target and `ArrowDrag.tsx`'s collider position can reuse
 * the exact same vector.
 *
 * Translating the shape, its camera position+target, and its collider by one shared
 * vector is what keeps every pre-Task-16 drag/validation/instrumentation test passing
 * unmodified at the new coordinates: a camera translated by the same vector as the thing
 * it's looking at has an identical relative position/orientation/distance, so the
 * screen-to-world mapping a mouse drag goes through is only shifted, never reshaped —
 * the same NDC delta from canvas center still produces the same drag *vector* (a
 * difference between two points), which is all `math/validation.ts` ever reads.
 */
export const SHAPE_POSITION: Record<'line' | 'plane' | 'cube', readonly [number, number, number]> = {
  line: [1.5, 0, 0],
  plane: [1.5, 1.5, 0],
  cube: [1.25, 1.25, 1.25],
}
