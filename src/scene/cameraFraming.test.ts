import { describe, expect, it } from 'vitest'
import {
  CAMERA_FRAMING,
  PLANE_TILT_RANGE,
  RESISTANCE_DISTANCE,
  easedTowardRange,
  resistedStep,
} from './cameraFraming'

describe('resistedStep', () => {
  it('applies the full step unchanged when the resulting position stays inside the free range', () => {
    expect(resistedStep(0, 0.35, [-1, 1])).toBe(0.35)
    expect(resistedStep(0.5, 0.35, [-1, 1])).toBe(0.35)
    expect(resistedStep(-0.5, -0.35, [-1, 1])).toBe(-0.35)
  })

  it('applies the full step on a fully unclamped range (Stage 3+), for any position', () => {
    expect(resistedStep(1000, 5, [-Infinity, Infinity])).toBe(5)
    expect(resistedStep(-1000, -5, [-Infinity, Infinity])).toBe(-5)
  })

  it('applies the full step right at the boundary (excess is exactly zero there)', () => {
    expect(resistedStep(1, 0.35, [-1, 1])).toBe(0.35)
    expect(resistedStep(-1, -0.35, [-1, 1])).toBe(-0.35)
  })

  it('shrinks a step that continues further past a boundary already crossed', () => {
    // RESISTANCE_DISTANCE past the +1 boundary -> factor exp(-1) (one "decay length" in)
    const step = resistedStep(1 + RESISTANCE_DISTANCE, 0.35, [-1, 1])
    expect(step).toBeCloseTo(0.35 * Math.exp(-1), 10)
    expect(step).toBeLessThan(0.35)
    expect(step).toBeGreaterThan(0)
  })

  it('resistance increases continuously the further past the boundary the current position already is', () => {
    const near = resistedStep(1.1, 0.35, [-1, 1])
    const far = resistedStep(3, 0.35, [-1, 1])
    expect(far).toBeLessThan(near)
    expect(far).toBeGreaterThan(0) // never fully zero, always some give
  })

  it('never resists a step heading back toward the free range from outside it', () => {
    // Past the +1 boundary (at 1.5), a *negative* step is heading back in, not further out.
    expect(resistedStep(1.5, -0.35, [-1, 1])).toBe(-0.35)
    // Symmetric case on the min side.
    expect(resistedStep(-1.5, 0.35, [-1, 1])).toBe(0.35)
  })

  it('resists in both directions off a zero-width range (Stage 1: any movement faces resistance)', () => {
    // The very first push off dead rest (excess 0 at the boundary itself) is unresisted...
    expect(resistedStep(0, 0.35, [0, 0])).toBe(0.35)
    // ...but continuing further out immediately after is.
    expect(resistedStep(0.35, 0.35, [0, 0])).toBeLessThan(0.35)
  })

  it('returns 0 unchanged for a zero raw step, regardless of position/range', () => {
    expect(resistedStep(5, 0, [-1, 1])).toBe(0)
  })
})

describe('easedTowardRange', () => {
  it('leaves a position already inside the range untouched', () => {
    expect(easedTowardRange(0.5, [-1, 1], 1)).toBe(0.5)
    expect(easedTowardRange(-1, [-1, 1], 0.5)).toBe(-1) // exactly on the boundary counts as inside
  })

  it('eases a fraction t of the way toward the nearest edge, not all the way to some separate rest value', () => {
    // Stage 2's own free range is [-PLANE_TILT_RANGE, PLANE_TILT_RANGE] = [-1, 1] -
    // settling should land at that edge (1), never all the way back to dead-on (0).
    const half = easedTowardRange(2, [-1, 1], 0.5)
    expect(half).toBeCloseTo(1.5, 10) // halfway from 2 to the nearest edge, 1
    expect(half).not.toBeCloseTo(0, 5)
  })

  it('eases toward the nearer edge, whichever side the position overshot', () => {
    expect(easedTowardRange(-2, [-1, 1], 0.5)).toBeCloseTo(-1.5, 10)
  })

  it('snaps exactly to the boundary once within the epsilon, rather than crawling forever', () => {
    const almostThere = easedTowardRange(1 + 1e-7, [-1, 1], 0.9)
    expect(almostThere).toBe(1)
  })

  it('at t=1, jumps straight to the boundary in one step', () => {
    expect(easedTowardRange(5, [-1, 1], 1)).toBe(1)
  })

  it('is a no-op on a zero-width range only when already exactly at rest', () => {
    expect(easedTowardRange(0, [0, 0], 1)).toBe(0)
    expect(easedTowardRange(0.4, [0, 0], 1)).toBe(0)
  })
})

describe('CAMERA_FRAMING (Task 23: every stage now defines a finite azimuth/polar range)', () => {
  it("Stage 1 (line) is zero-width — any movement at all is outside its free range", () => {
    const { azimuthRange, polarRange } = CAMERA_FRAMING.line
    expect(azimuthRange[0]).toBe(azimuthRange[1])
    expect(polarRange[0]).toBe(polarRange[1])
  })

  it('Stage 2 (plane) is PLANE_TILT_RANGE wide around dead-on', () => {
    const { azimuthRange, polarRange } = CAMERA_FRAMING.plane
    expect(azimuthRange[1] - azimuthRange[0]).toBeCloseTo(2 * PLANE_TILT_RANGE, 10)
    expect(polarRange[1] - polarRange[0]).toBeCloseTo(2 * PLANE_TILT_RANGE, 10)
  })

  it('Stage 3 on is fully unclamped, so resistedStep/easedTowardRange are permanent no-ops there', () => {
    for (const stage of ['cube', 'reveal', 'closing'] as const) {
      const { azimuthRange, polarRange } = CAMERA_FRAMING[stage]
      expect(azimuthRange).toEqual([-Infinity, Infinity])
      expect(resistedStep(1e6, 0.35, azimuthRange)).toBe(0.35)
      expect(easedTowardRange(1e6, azimuthRange, 1)).toBe(1e6)
      expect(easedTowardRange(polarRange[0], polarRange, 1)).toBe(polarRange[0])
    }
  })
})

describe('RESISTANCE_DISTANCE', () => {
  it('is a positive, finite tunable', () => {
    expect(RESISTANCE_DISTANCE).toBeGreaterThan(0)
    expect(Number.isFinite(RESISTANCE_DISTANCE)).toBe(true)
  })
})
