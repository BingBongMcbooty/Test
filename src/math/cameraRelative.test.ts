import { PerspectiveCamera, Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import { toCameraRelative } from './cameraRelative'

function makeCamera(position: Vector3, lookAt: Vector3): PerspectiveCamera {
  const camera = new PerspectiveCamera(50, 1, 0.1, 100)
  camera.position.copy(position)
  camera.lookAt(lookAt)
  camera.updateMatrixWorld(true)
  return camera
}

describe('toCameraRelative', () => {
  it('reads the origin as sitting straight ahead, at the camera-to-origin distance, when the camera looks at the origin', () => {
    // camera at (0,0,10) looking at the origin -> the origin is 10 units along the
    // camera's local -z (three.js cameras look down their own local -z).
    const camera = makeCamera(new Vector3(0, 0, 10), new Vector3(0, 0, 0))
    const result = toCameraRelative(new Vector3(0, 0, 0), camera)

    expect(result.x).toBeCloseTo(0)
    expect(result.y).toBeCloseTo(0)
    expect(result.z).toBeCloseTo(-10)
  })

  it('changes as the camera orbits around a world-fixed point — the whole point of Task 24’s camera-relative reading', () => {
    // A tracked point off to one side of the camera's look-at target (the cube's
    // center, in the real app — this is exactly why Stage 3's tracked *corner*, not
    // the cube's center itself, is what makes an orbit visibly change the reading:
    // a point sitting exactly at the look-at target would always read as dead-ahead
    // regardless of orbit angle, same as `toCameraRelative`'s other test cases show).
    const trackedPoint = new Vector3(1, 1, 1)

    const cameraA = makeCamera(new Vector3(0, 0, 10), new Vector3(0, 0, 0))
    const cameraB = makeCamera(new Vector3(10, 0, 0), new Vector3(0, 0, 0))

    const fromA = toCameraRelative(trackedPoint, cameraA)
    const fromB = toCameraRelative(trackedPoint, cameraB)

    // Same world point, same distance from the shared look-at target either way — but
    // a genuinely different reading once the camera has orbited around that target,
    // which is the property Stage 3's D-pad-driven readout depends on.
    expect(fromA).not.toEqual(fromB)
  })

  it('reads a point directly to the camera-local right as a positive x, with z equal to its straight-ahead depth', () => {
    // Camera at (0,0,10) looking at the origin (local +x = world +x here); a point at
    // world (5, 0, 0) is 5 units to the camera's local right and 10 units ahead.
    const camera = makeCamera(new Vector3(0, 0, 10), new Vector3(0, 0, 0))
    const result = toCameraRelative(new Vector3(5, 0, 0), camera)

    expect(result.x).toBeCloseTo(5)
    expect(result.y).toBeCloseTo(0)
    expect(result.z).toBeCloseTo(-10)
  })

  it('is the identity for a camera sitting at the world origin with no rotation', () => {
    const camera = new PerspectiveCamera(50, 1, 0.1, 100)
    camera.updateMatrixWorld(true)

    const result = toCameraRelative(new Vector3(3, -2, 7), camera)

    // Default three.js camera orientation looks down -z with +y up — a point already
    // expressed in world coordinates from that exact frame maps to itself.
    expect(result.x).toBeCloseTo(3)
    expect(result.y).toBeCloseTo(-2)
    expect(result.z).toBeCloseTo(7)
  })
})
