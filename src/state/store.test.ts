import { beforeEach, describe, expect, it } from 'vitest'
import { useDimensionsStore, type AttemptResult } from './store'

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
    getState().recordAttempt({ success: true, axisContributions: { x: 1, y: 0, z: 0 } })
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
    const result: AttemptResult = { success: false, axisContributions: { x: 0.5, y: 0.5, z: 0 } }
    getState().recordAttempt(result)
    const state = getState()
    expect(state.lastResult).toEqual(result)
    expect(state.attempts).toBe(1)
    expect(state.isDrawing).toBe(false)
  })

  it('accumulates across repeated failed attempts without resetting', () => {
    getState().recordAttempt({ success: false, axisContributions: { x: 1, y: 0, z: 0 } })
    getState().recordAttempt({ success: false, axisContributions: { x: 0, y: 1, z: 0 } })
    getState().recordAttempt({ success: false, axisContributions: { x: 0, y: 0, z: 1 } })
    expect(getState().attempts).toBe(3)
    expect(getState().lastResult?.axisContributions).toEqual({ x: 0, y: 0, z: 1 })
  })
})

describe('reset', () => {
  it('restores initial state from anywhere', () => {
    getState().setStage('reveal')
    getState().startDrawing()
    getState().recordAttempt({ success: true, axisContributions: { x: 1, y: 0, z: 0 } })
    getState().reset()
    const state = getState()
    expect(state.stage).toBe('line')
    expect(state.attempts).toBe(0)
    expect(state.isDrawing).toBe(false)
    expect(state.lastResult).toBeNull()
  })
})
