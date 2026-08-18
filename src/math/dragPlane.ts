import { Camera, Plane, Raycaster, Vector2, Vector3 } from 'three'

/**
 * A plane through `anchor`, facing the camera (normal = the camera's forward
 * direction). Used as the surface a 2D pointer drag gets raycast onto, so the
 * resulting 3D point tracks the pointer regardless of orbit angle.
 */
export function buildCameraFacingPlane(anchor: Vector3, camera: Camera): Plane {
  const normal = new Vector3()
  camera.getWorldDirection(normal)
  return new Plane().setFromNormalAndCoplanarPoint(normal, anchor)
}

/**
 * Raycasts a pointer position (NDC, each component in [-1, 1]) from `camera` onto
 * `plane`, returning the world-space hit point. Returns `null` if the ray never
 * meets the plane (ray direction parallel to the plane).
 */
export function raycastPointerOntoPlane(
  pointerNDC: Vector2,
  camera: Camera,
  plane: Plane,
  raycaster: Raycaster,
): Vector3 | null {
  raycaster.setFromCamera(pointerNDC, camera)
  const target = new Vector3()
  return raycaster.ray.intersectPlane(plane, target)
}
