import { ConeGeometry, CylinderGeometry, Quaternion, Vector3 } from 'three'

const SHAFT_RADIUS = 0.035
const HEAD_RADIUS = 0.09
const HEAD_LENGTH = 0.22
const MIN_LENGTH = 1e-4

const UP = new Vector3(0, 1, 0)

// Unit-sized (radius 1, height 1) and reused across every arrow instance — per-arrow
// shape comes from scaling/positioning the mesh, not rebuilding the geometry.
// Module-scoped (not inside a component) so both `LiveArrow` and Task 11's
// `FailCueArrow` share the same geometry instances; kept out of `LiveArrow.tsx` itself
// so that component file only exports the component (fast refresh requirement).
export const shaftGeometry = new CylinderGeometry(1, 1, 1, 12)
export const headGeometry = new ConeGeometry(1, 1, 16)

/**
 * Pure shaft/head transform for an arrow between two points, or `null` if they're
 * (near-)coincident.
 */
export function computeArrowTransform(start: Vector3, end: Vector3) {
  const delta = end.clone().sub(start)
  const length = delta.length()
  if (length < MIN_LENGTH) return null

  const direction = delta.clone().normalize()
  const quaternion = new Quaternion().setFromUnitVectors(UP, direction)
  const headLength = Math.min(HEAD_LENGTH, length * 0.5)
  const shaftLength = length - headLength

  return {
    quaternion,
    shaftScale: new Vector3(SHAFT_RADIUS, shaftLength, SHAFT_RADIUS),
    shaftPosition: start.clone().addScaledVector(direction, shaftLength / 2),
    headScale: new Vector3(HEAD_RADIUS, headLength, HEAD_RADIUS),
    headPosition: start.clone().addScaledVector(direction, shaftLength + headLength / 2),
  }
}
