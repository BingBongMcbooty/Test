import { describe, expect, it } from 'vitest'
import {
  PROJECTION_VIEWER_DISTANCE,
  TESSERACT_EDGES,
  TESSERACT_FACES,
  TESSERACT_VERTICES,
  type Vec4,
  projectTo3D,
  rotateXW,
  rotateYW,
  rotateYZ,
  sliceTesseract,
} from './fourd'

function countDiffAxes(a: Vec4, b: Vec4): number {
  let diffs = 0
  for (let i = 0; i < 4; i++) if (a[i] !== b[i]) diffs++
  return diffs
}

describe('tesseract generation', () => {
  it('has exactly 16 vertices, each coordinate +-1', () => {
    expect(TESSERACT_VERTICES).toHaveLength(16)
    for (const v of TESSERACT_VERTICES) {
      for (const coord of v) expect(Math.abs(coord)).toBe(1)
    }
  })

  it('has 16 distinct vertices', () => {
    const keys = new Set(TESSERACT_VERTICES.map((v) => v.join(',')))
    expect(keys.size).toBe(16)
  })

  it('has exactly 24 faces', () => {
    expect(TESSERACT_FACES).toHaveLength(24)
  })

  it('every face is a valid 4-cycle: consecutive vertices differ in exactly one axis', () => {
    for (const face of TESSERACT_FACES) {
      const corners = face.vertices.map((i) => TESSERACT_VERTICES[i])
      for (let i = 0; i < 4; i++) {
        const diffs = countDiffAxes(corners[i], corners[(i + 1) % 4])
        expect(diffs).toBe(1)
      }
    }
  })

  it('every face has 4 distinct vertex indices', () => {
    for (const face of TESSERACT_FACES) {
      expect(new Set(face.vertices).size).toBe(4)
    }
  })

  it('has exactly 32 edges, each connecting vertices that differ in one axis', () => {
    expect(TESSERACT_EDGES).toHaveLength(32)
    for (const edge of TESSERACT_EDGES) {
      const diffs = countDiffAxes(TESSERACT_VERTICES[edge.a], TESSERACT_VERTICES[edge.b])
      expect(diffs).toBe(1)
    }
  })

  it('every vertex touches exactly 4 edges', () => {
    const degree = new Array(16).fill(0)
    for (const edge of TESSERACT_EDGES) {
      degree[edge.a]++
      degree[edge.b]++
    }
    for (const d of degree) expect(d).toBe(4)
  })
})

describe('rotateXW / rotateYZ', () => {
  it('is the identity at angle 0', () => {
    const rotated = rotateXW(TESSERACT_VERTICES, 0)
    for (let i = 0; i < 16; i++) {
      for (let axis = 0; axis < 4; axis++) {
        expect(rotated[i][axis]).toBeCloseTo(TESSERACT_VERTICES[i][axis])
      }
    }
  })

  it('rotateXW leaves y/z untouched and preserves x^2 + w^2', () => {
    const rotated = rotateXW(TESSERACT_VERTICES, 0.7)
    for (let i = 0; i < 16; i++) {
      const [x, y, z, w] = TESSERACT_VERTICES[i]
      const [rx, ry, rz, rw] = rotated[i]
      expect(ry).toBeCloseTo(y)
      expect(rz).toBeCloseTo(z)
      expect(rx * rx + rw * rw).toBeCloseTo(x * x + w * w)
    }
  })

  it('rotateYZ leaves x/w untouched and preserves y^2 + z^2', () => {
    const rotated = rotateYZ(TESSERACT_VERTICES, 1.3)
    for (let i = 0; i < 16; i++) {
      const [x, y, z, w] = TESSERACT_VERTICES[i]
      const [rx, ry, rz, rw] = rotated[i]
      expect(rx).toBeCloseTo(x)
      expect(rw).toBeCloseTo(w)
      expect(ry * ry + rz * rz).toBeCloseTo(y * y + z * z)
    }
  })

  it('composes back to the start after a full 2*pi turn', () => {
    const rotated = rotateYZ(rotateXW(TESSERACT_VERTICES, Math.PI * 2), Math.PI * 2)
    for (let i = 0; i < 16; i++) {
      for (let axis = 0; axis < 4; axis++) {
        expect(rotated[i][axis]).toBeCloseTo(TESSERACT_VERTICES[i][axis])
      }
    }
  })

  it('rotateYW leaves x/z untouched and preserves y^2 + w^2', () => {
    const rotated = rotateYW(TESSERACT_VERTICES, 0.9)
    for (let i = 0; i < 16; i++) {
      const [x, y, z, w] = TESSERACT_VERTICES[i]
      const [rx, ry, rz, rw] = rotated[i]
      expect(rx).toBeCloseTo(x)
      expect(rz).toBeCloseTo(z)
      expect(ry * ry + rw * rw).toBeCloseTo(y * y + w * w)
    }
  })

  it('rotateXW then rotateYW composes back to the start after full 2*pi turns', () => {
    const rotated = rotateYW(rotateXW(TESSERACT_VERTICES, Math.PI * 2), Math.PI * 2)
    for (let i = 0; i < 16; i++) {
      for (let axis = 0; axis < 4; axis++) {
        expect(rotated[i][axis]).toBeCloseTo(TESSERACT_VERTICES[i][axis])
      }
    }
  })
})

describe('sliceTesseract', () => {
  it('an axis-aligned tesseract sliced at w=0 yields exactly a cube of 12 edges', () => {
    const edges = sliceTesseract(TESSERACT_VERTICES, TESSERACT_FACES, 0)
    expect(edges).toHaveLength(12)

    // Every resulting point should be a cube corner: x/y/z each exactly +-1.
    const pointKey = (p: { x: number; y: number; z: number }) =>
      `${Math.round(p.x)},${Math.round(p.y)},${Math.round(p.z)}`
    const points = new Set<string>()
    for (const edge of edges) {
      for (const p of [edge.a, edge.b]) {
        expect(Math.abs(p.x)).toBeCloseTo(1)
        expect(Math.abs(p.y)).toBeCloseTo(1)
        expect(Math.abs(p.z)).toBeCloseTo(1)
        points.add(pointKey(p))
      }
    }
    // exactly the 8 cube corners, each touched by exactly 3 of the 12 edges (12*2/8=3)
    expect(points.size).toBe(8)
  })

  it('an out-of-range w0 slices nothing', () => {
    expect(sliceTesseract(TESSERACT_VERTICES, TESSERACT_FACES, 5)).toHaveLength(0)
    expect(sliceTesseract(TESSERACT_VERTICES, TESSERACT_FACES, -5)).toHaveLength(0)
  })

  it('a mid-range slice (w0=0.5) still yields a closed set of segments with no NaNs', () => {
    const edges = sliceTesseract(TESSERACT_VERTICES, TESSERACT_FACES, 0.5)
    expect(edges.length).toBeGreaterThan(0)
    for (const edge of edges) {
      for (const p of [edge.a, edge.b]) {
        expect(Number.isNaN(p.x)).toBe(false)
        expect(Number.isNaN(p.y)).toBe(false)
        expect(Number.isNaN(p.z)).toBe(false)
      }
    }
  })

  it('rotateXW alone always leaves the slice spanning the full y/z range (the "always a box" degeneracy)', () => {
    // The slicing hyperplane's normal only ever picks up a component along an axis
    // that's been mixed with w — rotateXW confines that to x, so y and z stay fully
    // unconstrained by the slice no matter the rotation angle or offset. This is the
    // root cause a real playtest surfaced as the reveal stage's cross-section always
    // "wobbling" instead of changing shape: locked in here so it can't silently
    // regress back once RevealDrag.tsx's fix (driving rotateYW too) changes.
    for (const angle of [0.3, 0.9, 1.2]) {
      const rotated = rotateXW(TESSERACT_VERTICES, angle)
      const edges = sliceTesseract(rotated, TESSERACT_FACES, 0.4)
      const ys = edges.flatMap((edge) => [edge.a.y, edge.b.y])
      const zs = edges.flatMap((edge) => [edge.a.z, edge.b.z])
      expect(Math.min(...ys)).toBeCloseTo(-1)
      expect(Math.max(...ys)).toBeCloseTo(1)
      expect(Math.min(...zs)).toBeCloseTo(-1)
      expect(Math.max(...zs)).toBeCloseTo(1)
    }
  })

  it('composing rotateYW breaks that degeneracy: the slice y-range stops being a fixed +-1 regardless of the slice offset', () => {
    // With rotateXW alone, the previous test shows the y-range is exactly [-1, 1] no
    // matter what w0 is — the hyperplane has no y-component to its normal, so slicing
    // it anywhere never constrains y. Once rotateYW is composed in, the hyperplane's
    // normal has a real y-component, so *where* you slice (w0) should actually change
    // the y-range instead of it being a w0-independent constant.
    const rotated = rotateYW(rotateXW(TESSERACT_VERTICES, 0.3), 0.9)
    const yRangeAt = (w0: number) => {
      const edges = sliceTesseract(rotated, TESSERACT_FACES, w0)
      const ys = edges.flatMap((edge) => [edge.a.y, edge.b.y])
      return Math.max(...ys) - Math.min(...ys)
    }

    const rangeA = yRangeAt(0)
    const rangeB = yRangeAt(0.6)
    expect(Math.abs(rangeA - rangeB)).toBeGreaterThan(0.1)
  })
})

describe('projectTo3D', () => {
  it('matches the perspective-divide formula for an unrotated tesseract', () => {
    const projected = projectTo3D(TESSERACT_VERTICES)
    for (let i = 0; i < 16; i++) {
      const [x, y, z, w] = TESSERACT_VERTICES[i]
      const scale = PROJECTION_VIEWER_DISTANCE / (PROJECTION_VIEWER_DISTANCE - w)
      expect(projected[i].x).toBeCloseTo(x * scale)
      expect(projected[i].y).toBeCloseTo(y * scale)
      expect(projected[i].z).toBeCloseTo(z * scale)
    }
  })

  it('vertices nearer the viewer along w project larger (perspective, not orthographic)', () => {
    const projected = projectTo3D(TESSERACT_VERTICES)
    const nearIndex = TESSERACT_VERTICES.findIndex(
      ([x, y, z, w]) => x === 1 && y === 1 && z === 1 && w === 1,
    )
    const farIndex = TESSERACT_VERTICES.findIndex(
      ([x, y, z, w]) => x === 1 && y === 1 && z === 1 && w === -1,
    )
    expect(Math.abs(projected[nearIndex].x)).toBeGreaterThan(Math.abs(projected[farIndex].x))
  })
})

describe('rotation sweep sanity: no NaNs for either rendering path', () => {
  const angles = [0, 0.1, 0.5, 1, Math.PI / 4, Math.PI / 2, Math.PI, 2, 4, Math.PI * 2]

  it('projectTo3D stays finite across a sweep of xw/yz rotation combinations', () => {
    for (const xwAngle of angles) {
      for (const yzAngle of angles) {
        const rotated = rotateYZ(rotateXW(TESSERACT_VERTICES, xwAngle), yzAngle)
        const projected = projectTo3D(rotated)
        for (const p of projected) {
          expect(Number.isFinite(p.x)).toBe(true)
          expect(Number.isFinite(p.y)).toBe(true)
          expect(Number.isFinite(p.z)).toBe(true)
        }
      }
    }
  })

  it('sliceTesseract stays finite across a sweep of rotations and slice offsets', () => {
    const w0s = [-1, -0.5, 0, 0.3, 0.9, 1]
    for (const xwAngle of angles) {
      for (const yzAngle of angles) {
        const rotated = rotateYZ(rotateXW(TESSERACT_VERTICES, xwAngle), yzAngle)
        for (const w0 of w0s) {
          const edges = sliceTesseract(rotated, TESSERACT_FACES, w0)
          for (const edge of edges) {
            for (const p of [edge.a, edge.b]) {
              expect(Number.isFinite(p.x)).toBe(true)
              expect(Number.isFinite(p.y)).toBe(true)
              expect(Number.isFinite(p.z)).toBe(true)
            }
          }
        }
      }
    }
  })
})
