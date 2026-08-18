import type { Axis } from '../state/stageConfig'

export interface Vec3 {
  x: number
  y: number
  z: number
}

export interface AttemptResult {
  success: boolean
  /** each axis's share of the dragged vector's magnitude, fractions summing to ~1 */
  axisContributions: Record<Axis, number>
}

/**
 * Ratio of leftover-magnitude to total-magnitude a drag needs to count as "roughly
 * orthogonal" to the occupied subspace. 0.7 ~= sin(44deg) — see PLAN.md's tunables.
 */
export const ORTHOGONALITY_THRESHOLD = 0.7

function magnitude(v: Vec3): number {
  return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z)
}

/**
 * Zeroes out the occupied axes, leaving only the component of `vector` orthogonal to
 * the subspace they span. Occupied axes are always a subset of the standard basis, so
 * this is just component-wise zeroing rather than a general vector projection.
 */
export function projectOntoComplement(vector: Vec3, occupiedAxes: readonly Axis[]): Vec3 {
  const leftover = { ...vector }
  for (const axis of occupiedAxes) leftover[axis] = 0
  return leftover
}

function axisContributions(vector: Vec3): Record<Axis, number> {
  const total = Math.abs(vector.x) + Math.abs(vector.y) + Math.abs(vector.z)
  if (total === 0) return { x: 0, y: 0, z: 0 }
  return {
    x: Math.abs(vector.x) / total,
    y: Math.abs(vector.y) / total,
    z: Math.abs(vector.z) / total,
  }
}

/**
 * The one validation function behind all three drag stages: a drag succeeds when
 * enough of it points outside the subspace the stage's shape already occupies. For
 * the cube stage, occupiedAxes is all of x/y/z, so the leftover is always the zero
 * vector and success is structurally impossible — that's the Stage 3 property.
 */
export function evaluateAttempt(dragVector: Vec3, occupiedAxes: readonly Axis[]): AttemptResult {
  const total = magnitude(dragVector)
  const leftover = projectOntoComplement(dragVector, occupiedAxes)
  const ratio = total === 0 ? 0 : magnitude(leftover) / total

  return {
    success: ratio >= ORTHOGONALITY_THRESHOLD,
    axisContributions: axisContributions(dragVector),
  }
}
