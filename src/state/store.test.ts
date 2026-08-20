import { beforeEach, describe, expect, it } from 'vitest'
import type { AttemptResult } from '../math/validation'
import { useDimensionsStore } from './store'

const getState = () => useDimensionsStore.getState()

beforeEach(() => {
  getState().reset()
})

describe('initial state', () => {
  it('starts on the line stage with no attempts, not drawing, no result', () => {
    const state = getState()
    expect(state.stage).toBe('line')
    expect(state.attempts).toBe(0)
    expect(state.isDrawing).toBe(false)
    expect(state.lastResult).toBeNull()
  })

  it('starts Stage 4 state at the slice view, no rotation, no slice offset', () => {
    const state = getState()
    expect(state.revealView).toBe('slice')
    expect(state.revealRotationXW).toBe(0)
    expect(state.revealRotationYW).toBe(0)
    expect(state.revealSliceW0).toBe(0)
  })
})

describe('setStage', () => {
  it('sets the stage directly and clears per-stage state', () => {
    getState().startDrawing()
    getState().setStage('cube')
    const state = getState()
    expect(state.stage).toBe('cube')
    expect(state.attempts).toBe(0)
    expect(state.isDrawing).toBe(false)
    expect(state.lastResult).toBeNull()
  })
})

describe('advanceStage', () => {
  it('walks the stage order line -> plane -> cube -> reveal -> closing', () => {
    const order: ReturnType<typeof getState>['stage'][] = ['plane', 'cube', 'reveal', 'closing']
    for (const expected of order) {
      getState().advanceStage()
      expect(getState().stage).toBe(expected)
    }
  })

  it('clamps at the final stage instead of running off the end', () => {
    for (let i = 0; i < 10; i++) getState().advanceStage()
    expect(getState().stage).toBe('closing')
  })

  it('resets attempts, isDrawing, and lastResult on advance', () => {
    getState().startDrawing()
    getState().recordAttempt({ success: true, axisContributions: { x: 1, y: 0, z: 0 }, orthogonalityRatio: 1 })
    getState().advanceStage()
    const state = getState()
    expect(state.attempts).toBe(0)
    expect(state.isDrawing).toBe(false)
    expect(state.lastResult).toBeNull()
  })
})

describe('startDrawing / endDrawing', () => {
  it('toggles isDrawing', () => {
    getState().startDrawing()
    expect(getState().isDrawing).toBe(true)
    getState().endDrawing()
    expect(getState().isDrawing).toBe(false)
  })
})

describe('recordAttempt', () => {
  it('stores the result, increments attempts, and stops drawing', () => {
    getState().startDrawing()
    const result: AttemptResult = { success: false, axisContributions: { x: 0.5, y: 0.5, z: 0 }, orthogonalityRatio: 1 }
    getState().recordAttempt(result)
    const state = getState()
    expect(state.lastResult).toEqual(result)
    expect(state.attempts).toBe(1)
    expect(state.isDrawing).toBe(false)
  })

  it('accumulates across repeated failed attempts without resetting', () => {
    getState().recordAttempt({ success: false, axisContributions: { x: 1, y: 0, z: 0 }, orthogonalityRatio: 1 })
    getState().recordAttempt({ success: false, axisContributions: { x: 0, y: 1, z: 0 }, orthogonalityRatio: 1 })
    getState().recordAttempt({ success: false, axisContributions: { x: 0, y: 0, z: 1 }, orthogonalityRatio: 1 })
    expect(getState().attempts).toBe(3)
    expect(getState().lastResult?.axisContributions).toEqual({ x: 0, y: 0, z: 1 })
  })
})

describe('setLiveDragVector', () => {
  it('sets and clears the live readout value', () => {
    getState().setLiveDragVector({ x: 1, y: 2, z: 3 })
    expect(getState().liveDragVector).toEqual({ x: 1, y: 2, z: 3 })
    getState().setLiveDragVector(null)
    expect(getState().liveDragVector).toBeNull()
  })

  it('is cleared on setStage and advanceStage, like the other per-stage fields', () => {
    getState().setLiveDragVector({ x: 1, y: 2, z: 3 })
    getState().setStage('cube')
    expect(getState().liveDragVector).toBeNull()

    getState().setLiveDragVector({ x: 1, y: 2, z: 3 })
    getState().advanceStage()
    expect(getState().liveDragVector).toBeNull()
  })

  it('is not itself touched by recordAttempt — ArrowDrag.tsx clears it separately on pointer-up', () => {
    getState().setLiveDragVector({ x: 1, y: 2, z: 3 })
    getState().recordAttempt({ success: false, axisContributions: { x: 1, y: 0, z: 0 }, orthogonalityRatio: 0 })
    expect(getState().liveDragVector).toEqual({ x: 1, y: 2, z: 3 })
  })
})

describe('toggleRevealView', () => {
  it('flips between slice and projection', () => {
    expect(getState().revealView).toBe('slice')
    getState().toggleRevealView()
    expect(getState().revealView).toBe('projection')
    getState().toggleRevealView()
    expect(getState().revealView).toBe('slice')
  })
})

describe('rotateRevealXW / rotateRevealYW', () => {
  it('accumulates rotation across calls, including negative deltas', () => {
    getState().rotateRevealXW(0.4)
    getState().rotateRevealXW(0.3)
    expect(getState().revealRotationXW).toBeCloseTo(0.7)
    getState().rotateRevealXW(-0.2)
    expect(getState().revealRotationXW).toBeCloseTo(0.5)
  })

  it('tracks the two rotation planes independently', () => {
    getState().rotateRevealXW(0.4)
    getState().rotateRevealYW(1.1)
    expect(getState().revealRotationXW).toBeCloseTo(0.4)
    expect(getState().revealRotationYW).toBeCloseTo(1.1)
  })
})

describe('adjustRevealSlice', () => {
  it('accumulates the slice offset across calls', () => {
    getState().adjustRevealSlice(0.3)
    getState().adjustRevealSlice(0.2)
    expect(getState().revealSliceW0).toBeCloseTo(0.5)
  })

  it('clamps to +-REVEAL_SLICE_RANGE instead of drifting past it', () => {
    getState().adjustRevealSlice(10)
    expect(getState().revealSliceW0).toBe(1.5)
    getState().adjustRevealSlice(-10)
    expect(getState().revealSliceW0).toBe(-1.5)
  })
})

describe('reset', () => {
  it('restores initial state from anywhere', () => {
    getState().setStage('reveal')
    getState().startDrawing()
    getState().recordAttempt({ success: true, axisContributions: { x: 1, y: 0, z: 0 }, orthogonalityRatio: 1 })
    getState().toggleRevealView()
    getState().rotateRevealXW(1.2)
    getState().rotateRevealYW(0.6)
    getState().adjustRevealSlice(0.8)
    getState().reset()
    const state = getState()
    expect(state.stage).toBe('line')
    expect(state.attempts).toBe(0)
    expect(state.isDrawing).toBe(false)
    expect(state.lastResult).toBeNull()
    expect(state.revealView).toBe('slice')
    expect(state.revealRotationXW).toBe(0)
    expect(state.revealRotationYW).toBe(0)
    expect(state.revealSliceW0).toBe(0)
  })
})
