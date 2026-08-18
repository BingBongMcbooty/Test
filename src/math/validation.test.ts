import { describe, expect, it } from 'vitest'
import { ORTHOGONALITY_THRESHOLD, evaluateAttempt, projectOntoComplement, type Vec3 } from './validation'

describe('ORTHOGONALITY_THRESHOLD', () => {
  it('is the 0.7 ratio (~44 deg tolerance) documented in PLAN.md', () => {
    expect(ORTHOGONALITY_THRESHOLD).toBe(0.7)
  })
})

describe('projectOntoComplement', () => {
  it('zeroes a single occupied axis, leaving the rest untouched', () => {
    // occupied = x only -> leftover is the (y, z) part of the vector
    const leftover = projectOntoComplement({ x: 1, y: 2, z: 3 }, ['x'])
    expect(leftover).toEqual({ x: 0, y: 2, z: 3 })
  })

  it('zeroes multiple occupied axes', () => {
    // occupied = x, z -> leftover is just the y component
    const leftover = projectOntoComplement({ x: 1, y: 2, z: 3 }, ['x', 'z'])
    expect(leftover).toEqual({ x: 0, y: 2, z: 0 })
  })

  it('zeroes everything when all three axes are occupied (the cube stage)', () => {
    const leftover = projectOntoComplement({ x: 5, y: -7, z: 2 }, ['x', 'y', 'z'])
    expect(leftover).toEqual({ x: 0, y: 0, z: 0 })
  })

  it('returns the vector unchanged when nothing is occupied', () => {
    const vector: Vec3 = { x: 1, y: 2, z: 3 }
    expect(projectOntoComplement(vector, [])).toEqual(vector)
  })
})

describe('evaluateAttempt — line stage (occupied = x)', () => {
  it('passes on an exactly-orthogonal drag', () => {
    // leftover = (0, 3, 4), |leftover| = 5, |total| = 5 -> ratio = 1.0
    const result = evaluateAttempt({ x: 0, y: 3, z: 4 }, ['x'])
    expect(result.success).toBe(true)
  })

  it('fails on an exactly-parallel drag', () => {
    // leftover = (0, 0, 0), |leftover| = 0, |total| = 5 -> ratio = 0
    const result = evaluateAttempt({ x: 5, y: 0, z: 0 }, ['x'])
    expect(result.success).toBe(false)
  })

  it('passes just above the threshold (3-4-5 triangle, ratio = 0.8)', () => {
    // leftover = (0, 4, 0), |leftover| = 4, |total| = sqrt(3^2+4^2) = 5 -> ratio = 0.8 >= 0.7
    const result = evaluateAttempt({ x: 3, y: 4, z: 0 }, ['x'])
    expect(result.success).toBe(true)
  })

  it('fails just below the threshold (3-4-5 triangle, ratio = 0.6)', () => {
    // leftover = (0, 3, 0), |leftover| = 3, |total| = sqrt(4^2+3^2) = 5 -> ratio = 0.6 < 0.7
    const result = evaluateAttempt({ x: 4, y: 3, z: 0 }, ['x'])
    expect(result.success).toBe(false)
  })
})

describe('evaluateAttempt — plane stage (occupied = x, y)', () => {
  it('passes on an exactly-orthogonal drag (pure z)', () => {
    // leftover = (0, 0, 5), ratio = 1.0
    const result = evaluateAttempt({ x: 0, y: 0, z: 5 }, ['x', 'y'])
    expect(result.success).toBe(true)
  })

  it('fails on a drag entirely inside the plane', () => {
    // leftover = (0, 0, 0), ratio = 0
    const result = evaluateAttempt({ x: 3, y: 4, z: 0 }, ['x', 'y'])
    expect(result.success).toBe(false)
  })
})

describe('evaluateAttempt — cube stage (occupied = x, y, z): always fails', () => {
  const cases: Vec3[] = [
    { x: 1, y: 1, z: 1 },
    { x: 0, y: 0, z: 7 },
    { x: -3, y: 5, z: -2 },
    { x: 100, y: 0, z: 0 },
  ]

  it.each(cases)('leftover is the zero vector for %o, so success is always false', (vector) => {
    // occupied = full 3D basis -> projectOntoComplement always returns (0,0,0) -> ratio = 0
    const result = evaluateAttempt(vector, ['x', 'y', 'z'])
    expect(result.success).toBe(false)
  })
})

describe('evaluateAttempt — axisContributions', () => {
  it('splits magnitude proportionally across axes', () => {
    // |x|+|y|+|z| = 1+2+3 = 6 -> fractions 1/6, 2/6, 3/6
    const result = evaluateAttempt({ x: 1, y: 2, z: 3 }, ['x'])
    expect(result.axisContributions.x).toBeCloseTo(1 / 6)
    expect(result.axisContributions.y).toBeCloseTo(2 / 6)
    expect(result.axisContributions.z).toBeCloseTo(3 / 6)
  })

  it('uses the drag vector itself, independent of which axes are occupied', () => {
    const a = evaluateAttempt({ x: 1, y: 2, z: 3 }, ['x'])
    const b = evaluateAttempt({ x: 1, y: 2, z: 3 }, ['x', 'y', 'z'])
    expect(a.axisContributions).toEqual(b.axisContributions)
  })

  it('is all zero for a zero-length drag, without dividing by zero', () => {
    const result = evaluateAttempt({ x: 0, y: 0, z: 0 }, ['x'])
    expect(result.axisContributions).toEqual({ x: 0, y: 0, z: 0 })
    expect(result.success).toBe(false)
  })
})
