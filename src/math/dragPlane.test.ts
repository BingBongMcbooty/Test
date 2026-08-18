import { OrthographicCamera, Plane, Raycaster, Vector2, Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import { buildCameraFacingPlane, raycastPointerOntoPlane } from './dragPlane'

// Orthographic camera with a symmetric [-5, 5] x [-5, 5] frustum, so NDC -> world
// offset along the camera's local right/up axes is exactly ndc * 5 (no perspective
// divide to account for).
function makeOrthoCamera(position: Vector3, lookAt: Vector3): OrthographicCamera {
  const camera = new OrthographicCamera(-5, 5, 5, -5, 0.1, 100)
  camera.position.copy(position)
  camera.lookAt(lookAt)
  camera.updateProjectionMatrix()
  camera.updateMatrixWorld(true)
  return camera
}

describe('buildCameraFacingPlane', () => {
  it('faces straight along -z for a camera looking down -z', () => {
    // camera at (0,0,10) looking at the origin -> forward = (0,0,-1)
    const camera = makeOrthoCamera(new Vector3(0, 0, 10), new Vector3(0, 0, 0))
    const plane = buildCameraFacingPlane(new Vector3(0, 0, 0), camera)

    expect(plane.normal.x).toBeCloseTo(0)
    expect(plane.normal.y).toBeCloseTo(0)
    expect(plane.normal.z).toBeCloseTo(-1)
    // plane passes through the anchor (the origin) -> normal . point + constant = 0
    expect(plane.constant).toBeCloseTo(0)
  })

  it('rotates its normal to match the camera, not a fixed world axis', () => {
    // camera at (10,0,0) looking at the origin -> forward = (-1,0,0)
    const camera = makeOrthoCamera(new Vector3(10, 0, 0), new Vector3(0, 0, 0))
    const plane = buildCameraFacingPlane(new Vector3(0, 0, 0), camera)

    expect(plane.normal.x).toBeCloseTo(-1)
    expect(plane.normal.y).toBeCloseTo(0)
    expect(plane.normal.z).toBeCloseTo(0)
    expect(plane.constant).toBeCloseTo(0)
  })

  it('passes through an off-origin anchor', () => {
    // camera looks down -z again, anchor at z=1 -> plane equation (0,0,-1).X + c = 0
    // satisfied at z=1 means c = 1
    const camera = makeOrthoCamera(new Vector3(0, 0, 10), new Vector3(0, 0, 0))
    const plane = buildCameraFacingPlane(new Vector3(2, 3, 1), camera)

    expect(plane.constant).toBeCloseTo(1)
    expect(plane.distanceToPoint(new Vector3(2, 3, 1))).toBeCloseTo(0)
  })
})

describe('raycastPointerOntoPlane', () => {
  it('lands on the anchor for a centered pointer', () => {
    const camera = makeOrthoCamera(new Vector3(0, 0, 10), new Vector3(0, 0, 0))
    const anchor = new Vector3(0, 0, 0)
    const plane = buildCameraFacingPlane(anchor, camera)

    const hit = raycastPointerOntoPlane(new Vector2(0, 0), camera, plane, new Raycaster())

    expect(hit).not.toBeNull()
    expect(hit!.x).toBeCloseTo(0)
    expect(hit!.y).toBeCloseTo(0)
    expect(hit!.z).toBeCloseTo(0)
  })

  it('offsets the hit point along the camera-relative axes with the pointer', () => {
    // ortho frustum half-width/height = 5, so ndc=1 on either axis -> ray origin
    // shifted by 5 along the camera's local right/up, landing at (5,0,0) / (0,5,0)
    // once it travels down to the anchor's z=0 plane.
    const camera = makeOrthoCamera(new Vector3(0, 0, 10), new Vector3(0, 0, 0))
    const anchor = new Vector3(0, 0, 0)
    const plane = buildCameraFacingPlane(anchor, camera)
    const raycaster = new Raycaster()

    const right = raycastPointerOntoPlane(new Vector2(1, 0), camera, plane, raycaster)
    expect(right!.x).toBeCloseTo(5)
    expect(right!.y).toBeCloseTo(0)
    expect(right!.z).toBeCloseTo(0)

    const up = raycastPointerOntoPlane(new Vector2(0, 1), camera, plane, raycaster)
    expect(up!.x).toBeCloseTo(0)
    expect(up!.y).toBeCloseTo(5)
    expect(up!.z).toBeCloseTo(0)
  })

  it('follows the plane when the camera looks down a different world axis', () => {
    // camera at (10,0,0) looking at the origin: forward = (-1,0,0), and lookAt's
    // convention (local +X = normalize(up x backward)) puts local +X along world
    // (0,0,-1) here, so ndc=(1,0) shifts the ray origin by 5 along (0,0,-1).
    const camera = makeOrthoCamera(new Vector3(10, 0, 0), new Vector3(0, 0, 0))
    const anchor = new Vector3(0, 0, 0)
    const plane = buildCameraFacingPlane(anchor, camera)
    const raycaster = new Raycaster()

    const centered = raycastPointerOntoPlane(new Vector2(0, 0), camera, plane, raycaster)
    expect(centered!.x).toBeCloseTo(0)
    expect(centered!.y).toBeCloseTo(0)
    expect(centered!.z).toBeCloseTo(0)

    const shifted = raycastPointerOntoPlane(new Vector2(1, 0), camera, plane, raycaster)
    expect(shifted!.x).toBeCloseTo(0)
    expect(shifted!.y).toBeCloseTo(0)
    expect(shifted!.z).toBeCloseTo(-5)
  })

  it('reaches an off-origin anchor plane at the expected depth, independent of pointer x/y', () => {
    // camera at (0,0,10) looking at origin, anchor at (2,3,1) -> plane is z=1.
    // A ray down -z from (0,0,10) hits z=1 after t=9, landing at (0,0,1); the pointer
    // offset only moves the ray's x/y start, not the z it stops at.
    const camera = makeOrthoCamera(new Vector3(0, 0, 10), new Vector3(0, 0, 0))
    const plane = buildCameraFacingPlane(new Vector3(2, 3, 1), camera)
    const raycaster = new Raycaster()

    const hit = raycastPointerOntoPlane(new Vector2(1, 0), camera, plane, raycaster)
    expect(hit!.x).toBeCloseTo(5)
    expect(hit!.y).toBeCloseTo(0)
    expect(hit!.z).toBeCloseTo(1)
  })

  it('returns null when the ray never meets the plane', () => {
    // camera looks down -z, so every ray direction is (0,0,-1). A plane with
    // normal (0,1,0) is perpendicular to that direction (dot = 0), and the ray's
    // origin (0,0,10) isn't on the plane (distance = -1), so there is no intersection.
    const camera = makeOrthoCamera(new Vector3(0, 0, 10), new Vector3(0, 0, 0))
    const plane = new Plane(new Vector3(0, 1, 0), -1)

    const hit = raycastPointerOntoPlane(new Vector2(0, 0), camera, plane, new Raycaster())

    expect(hit).toBeNull()
  })
})
