import { describe, expect, it } from 'vitest'
import {
  CONE_EDGES,
  CONE_FACES,
  CONE_HEIGHT,
  CONE_RADIAL_SEGMENTS,
  CONE_RADIUS,
  CONE_VERTICES,
  sliceCone,
  tiltCone,
} from './coneSlice'

describe('cone generation', () => {
  it('has an apex, a ring of rim vertices, and a base center — N + 2 vertices total', () => {
    expect(CONE_VERTICES).toHaveLength(CONE_RADIAL_SEGMENTS + 2)
  })

  it('the apex sits at +HEIGHT/2 on the axis', () => {
    const apex = CONE_VERTICES[0]
    expect(apex.x).toBeCloseTo(0)
    expect(apex.y).toBeCloseTo(0)
    expect(apex.z).toBeCloseTo(CONE_HEIGHT / 2)
  })

  it('every rim vertex sits at -HEIGHT/2, radius CONE_RADIUS from the axis', () => {
    for (let i = 1; i <= CONE_RADIAL_SEGMENTS; i++) {
      const v = CONE_VERTICES[i]
      expect(v.z).toBeCloseTo(-CONE_HEIGHT / 2)
      expect(Math.hypot(v.x, v.y)).toBeCloseTo(CONE_RADIUS)
    }
  })

  it('has 2 * N triangular faces (side + base cap)', () => {
    expect(CONE_FACES).toHaveLength(CONE_RADIAL_SEGMENTS * 2)
  })

  it('every face is a triangle of 3 distinct vertex indices', () => {
    for (const face of CONE_FACES) {
      expect(new Set(face.vertices).size).toBe(3)
    }
  })

  it('has 3 * N edges (apex-to-rim, rim ring, base-to-rim)', () => {
    expect(CONE_EDGES).toHaveLength(CONE_RADIAL_SEGMENTS * 3)
  })
})

describe('tiltCone', () => {
  it('is the identity at angle 0', () => {
    const tilted = tiltCone(CONE_VERTICES, 0)
    for (let i = 0; i < CONE_VERTICES.length; i++) {
      expect(tilted[i].x).toBeCloseTo(CONE_VERTICES[i].x)
      expect(tilted[i].y).toBeCloseTo(CONE_VERTICES[i].y)
      expect(tilted[i].z).toBeCloseTo(CONE_VERTICES[i].z)
    }
  })

  it('leaves x untouched and preserves y^2 + z^2', () => {
    const tilted = tiltCone(CONE_VERTICES, 0.6)
    for (let i = 0; i < CONE_VERTICES.length; i++) {
      const { x, y, z } = CONE_VERTICES[i]
      const t = tilted[i]
      expect(t.x).toBeCloseTo(x)
      expect(t.y * t.y + t.z * t.z).toBeCloseTo(y * y + z * z)
    }
  })

  it('composes back to the start after a full 2*pi turn', () => {
    const tilted = tiltCone(CONE_VERTICES, Math.PI * 2)
    for (let i = 0; i < CONE_VERTICES.length; i++) {
      expect(tilted[i].x).toBeCloseTo(CONE_VERTICES[i].x)
      expect(tilted[i].y).toBeCloseTo(CONE_VERTICES[i].y)
      expect(tilted[i].z).toBeCloseTo(CONE_VERTICES[i].z)
    }
  })
})

describe('sliceCone', () => {
  it('an untilted cone sliced through its middle yields a circle of radius CONE_RADIUS/2', () => {
    const segments = sliceCone(CONE_VERTICES, CONE_FACES, 0)
    expect(segments.length).toBeGreaterThan(0)
    for (const segment of segments) {
      for (const p of [segment.a, segment.b]) {
        expect(Math.hypot(p.x, p.y)).toBeCloseTo(CONE_RADIUS / 2, 1)
      }
    }
  })

  it('an out-of-range z0 slices nothing', () => {
    expect(sliceCone(CONE_VERTICES, CONE_FACES, 5)).toHaveLength(0)
    expect(sliceCone(CONE_VERTICES, CONE_FACES, -5)).toHaveLength(0)
  })

  it('an untilted cone: the circle shrinks as the slice moves toward the apex', () => {
    const radiusAt = (z0: number) => {
      const segments = sliceCone(CONE_VERTICES, CONE_FACES, z0)
      const rs = segments.flatMap((s) => [Math.hypot(s.a.x, s.a.y), Math.hypot(s.b.x, s.b.y)])
      return rs.length > 0 ? Math.max(...rs) : 0
    }
    expect(radiusAt(-0.5)).toBeGreaterThan(radiusAt(0.5))
    expect(radiusAt(0.9)).toBeGreaterThan(radiusAt(0.99))
  })

  it('near the apex the cross-section degenerates to a point (near-zero extent)', () => {
    const segments = sliceCone(CONE_VERTICES, CONE_FACES, CONE_HEIGHT / 2 - 1e-6)
    for (const segment of segments) {
      expect(Math.hypot(segment.a.x, segment.a.y)).toBeCloseTo(0, 3)
      expect(Math.hypot(segment.b.x, segment.b.y)).toBeCloseTo(0, 3)
    }
  })

  it('tilting the cone turns the circular cross-section into a non-circular one', () => {
    // An untilted cone sliced anywhere always gives a perfect circle (constant radius
    // from the axis at every point) — this is the exact one-dimension-down analogue of
    // `fourd.test.ts`'s "always a box" degeneracy: a single tilt axis is what breaks it
    // here (unlike the tesseract, which needs a second rotation plane), since the
    // cutting plane's normal is fixed at z regardless of rotation.
    const tilted = tiltCone(CONE_VERTICES, 0.5)
    const segments = sliceCone(tilted, CONE_FACES, 0)
    expect(segments.length).toBeGreaterThan(0)
    const radii = segments.flatMap((s) => [Math.hypot(s.a.x, s.a.y), Math.hypot(s.b.x, s.b.y)])
    expect(Math.max(...radii) - Math.min(...radii)).toBeGreaterThan(0.05)
  })

  it('stays finite across a sweep of tilt angles and slice offsets', () => {
    const angles = [0, 0.2, 0.5, 0.9, 1.2, Math.PI / 2]
    const z0s = [-1.3, -0.5, 0, 0.5, 0.9, 1.3]
    for (const angle of angles) {
      const tilted = tiltCone(CONE_VERTICES, angle)
      for (const z0 of z0s) {
        const segments = sliceCone(tilted, CONE_FACES, z0)
        for (const segment of segments) {
          for (const p of [segment.a, segment.b]) {
            expect(Number.isFinite(p.x)).toBe(true)
            expect(Number.isFinite(p.y)).toBe(true)
          }
        }
      }
    }
  })
})
