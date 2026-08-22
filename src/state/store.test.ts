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
    getState().recordAttempt({
      success: true,
      axisContributions: { x: 1, y: 0, z: 0 },
      orthogonalityRatio: 1,
    })
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
    const result: AttemptResult = {
      success: false,
      axisContributions: { x: 0.5, y: 0.5, z: 0 },
      orthogonalityRatio: 1,
    }
    getState().recordAttempt(result)
    const state = getState()
    expect(state.lastResult).toEqual(result)
    expect(state.attempts).toBe(1)
    expect(state.isDrawing).toBe(false)
  })

  it('accumulates across repeated failed attempts without resetting', () => {
    getState().recordAttempt({
      success: false,
      axisContributions: { x: 1, y: 0, z: 0 },
      orthogonalityRatio: 1,
    })
    getState().recordAttempt({
      success: false,
      axisContributions: { x: 0, y: 1, z: 0 },
      orthogonalityRatio: 1,
    })
    getState().recordAttempt({
      success: false,
      axisContributions: { x: 0, y: 0, z: 1 },
      orthogonalityRatio: 1,
    })
    expect(getState().attempts).toBe(3)
    expect(getState().lastResult?.axisContributions).toEqual({ x: 0, y: 0, z: 1 })
  })
})

describe('showStageWelcome / dismissStageWelcome (post-Task-18-removal: the auto-advance welcome beat)', () => {
  it('starts true — a fresh load welcomes the player to the 1st dimension with no advanceStage() call needed', () => {
    expect(getState().stage).toBe('line')
    expect(getState().showStageWelcome).toBe(true)
  })

  it('advanceStage sets it true landing on plane or cube', () => {
    getState().dismissStageWelcome()
    getState().advanceStage() // -> plane
    expect(getState().showStageWelcome).toBe(true)
    getState().dismissStageWelcome()
    getState().advanceStage() // -> cube
    expect(getState().showStageWelcome).toBe(true)
  })

  it('advanceStage does NOT set it for cube->reveal or reveal->closing — no 4th dimension to welcome the player into', () => {
    getState().setStage('cube')
    getState().advanceStage() // -> reveal
    expect(getState().showStageWelcome).toBe(false)
    getState().advanceStage() // -> closing
    expect(getState().showStageWelcome).toBe(false)
  })

  it('setStage always clears it — a debug jump is never a real arrival', () => {
    getState().setStage('plane')
    expect(getState().showStageWelcome).toBe(false)
  })

  it('dismissStageWelcome clears it without touching the stage', () => {
    expect(getState().showStageWelcome).toBe(true)
    getState().dismissStageWelcome()
    expect(getState().showStageWelcome).toBe(false)
    expect(getState().stage).toBe('line')
  })

  it('reset restores it to true, alongside Stage 1', () => {
    getState().dismissStageWelcome()
    getState().setStage('cube')
    getState().reset()
    expect(getState().stage).toBe('line')
    expect(getState().showStageWelcome).toBe(true)
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
    getState().recordAttempt({
      success: false,
      axisContributions: { x: 1, y: 0, z: 0 },
      orthogonalityRatio: 0,
    })
    expect(getState().liveDragVector).toEqual({ x: 1, y: 2, z: 3 })
  })
})

describe('setLiveCursorPoint', () => {
  it('sets and clears the live cursor readout value', () => {
    getState().setLiveCursorPoint({ x: 1, y: 2, z: 0 })
    expect(getState().liveCursorPoint).toEqual({ x: 1, y: 2, z: 0 })
    getState().setLiveCursorPoint(null)
    expect(getState().liveCursorPoint).toBeNull()
  })

  it('is cleared on setStage and advanceStage, like the other per-stage fields', () => {
    getState().setLiveCursorPoint({ x: 1, y: 2, z: 0 })
    getState().setStage('cube')
    expect(getState().liveCursorPoint).toBeNull()

    getState().setLiveCursorPoint({ x: 1, y: 2, z: 0 })
    getState().advanceStage()
    expect(getState().liveCursorPoint).toBeNull()
  })

  it('is independent of liveDragVector — a plain cursor move never touches the drag field', () => {
    getState().setLiveCursorPoint({ x: 1, y: 2, z: 0 })
    expect(getState().liveDragVector).toBeNull()
  })
})

describe('setTrackedCubeVertexCamera', () => {
  it('sets and clears the camera-relative tracked-vertex readout', () => {
    getState().setTrackedCubeVertexCamera({ x: 1, y: 2, z: -9 })
    expect(getState().trackedCubeVertexCamera).toEqual({ x: 1, y: 2, z: -9 })
    getState().setTrackedCubeVertexCamera(null)
    expect(getState().trackedCubeVertexCamera).toBeNull()
  })

  it('is cleared on setStage and advanceStage, like the other per-stage fields', () => {
    getState().setTrackedCubeVertexCamera({ x: 1, y: 2, z: -9 })
    getState().setStage('line')
    expect(getState().trackedCubeVertexCamera).toBeNull()

    getState().setStage('cube')
    getState().setTrackedCubeVertexCamera({ x: 1, y: 2, z: -9 })
    getState().advanceStage()
    expect(getState().trackedCubeVertexCamera).toBeNull()
  })
})

describe('toggleRevealView', () => {
  it('cycles slice -> projection -> chirality -> slice', () => {
    expect(getState().revealView).toBe('slice')
    getState().toggleRevealView()
    expect(getState().revealView).toBe('projection')
    getState().toggleRevealView()
    expect(getState().revealView).toBe('chirality')
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

describe('revealWarmupActive / finishRevealWarmup', () => {
  it('starts false', () => {
    expect(getState().revealWarmupActive).toBe(false)
  })

  it('advanceStage sets it true only when landing on reveal, not other stages', () => {
    getState().advanceStage() // -> plane
    expect(getState().revealWarmupActive).toBe(false)
    getState().advanceStage() // -> cube
    expect(getState().revealWarmupActive).toBe(false)
    getState().advanceStage() // -> reveal
    expect(getState().revealWarmupActive).toBe(true)
    getState().advanceStage() // -> closing
    expect(getState().revealWarmupActive).toBe(false)
  })

  it('setStage never activates it, even when jumping straight to reveal', () => {
    getState().setStage('reveal')
    expect(getState().stage).toBe('reveal')
    expect(getState().revealWarmupActive).toBe(false)
  })

  it('setStage clears it if it was already active', () => {
    getState().setStage('cube')
    getState().advanceStage() // -> reveal, activates the warmup
    expect(getState().revealWarmupActive).toBe(true)
    getState().setStage('reveal')
    expect(getState().revealWarmupActive).toBe(false)
  })

  it('finishRevealWarmup clears it without touching the stage', () => {
    getState().setStage('cube')
    getState().advanceStage()
    expect(getState().revealWarmupActive).toBe(true)
    getState().finishRevealWarmup()
    expect(getState().revealWarmupActive).toBe(false)
    expect(getState().stage).toBe('reveal')
  })

  it('is cleared by reset', () => {
    getState().setStage('cube')
    getState().advanceStage()
    getState().reset()
    expect(getState().revealWarmupActive).toBe(false)
  })
})

describe('growthTransition / finishGrowthTransition', () => {
  it('starts null', () => {
    expect(getState().growthTransition).toBeNull()
  })

  it('advanceStage sets it for line->plane and plane->cube, the only two growth edges', () => {
    getState().advanceStage() // line -> plane
    expect(getState().growthTransition).toEqual({ from: 'line', to: 'plane' })
    getState().advanceStage() // plane -> cube
    expect(getState().growthTransition).toEqual({ from: 'plane', to: 'cube' })
  })

  it('advanceStage does NOT set it for cube->reveal — the deliberate exception (no growing into the 4th)', () => {
    getState().setStage('cube')
    getState().advanceStage() // cube -> reveal
    expect(getState().stage).toBe('reveal')
    expect(getState().growthTransition).toBeNull()
  })

  it('advanceStage does not set it for reveal->closing, or the clamped no-op past closing', () => {
    getState().setStage('reveal')
    getState().advanceStage() // reveal -> closing
    expect(getState().growthTransition).toBeNull()
    getState().advanceStage() // clamped, still closing
    expect(getState().growthTransition).toBeNull()
  })

  it('setStage never activates it, even jumping straight from line to plane', () => {
    getState().setStage('plane')
    expect(getState().stage).toBe('plane')
    expect(getState().growthTransition).toBeNull()
  })

  it('setStage clears it if a real advance had just set it', () => {
    getState().advanceStage() // line -> plane, sets growthTransition
    expect(getState().growthTransition).not.toBeNull()
    getState().setStage('plane')
    expect(getState().growthTransition).toBeNull()
  })

  it('finishGrowthTransition clears it without touching the stage', () => {
    getState().advanceStage() // line -> plane
    expect(getState().growthTransition).toEqual({ from: 'line', to: 'plane' })
    getState().finishGrowthTransition()
    expect(getState().growthTransition).toBeNull()
    expect(getState().stage).toBe('plane')
  })

  it('is cleared by reset', () => {
    getState().advanceStage()
    getState().reset()
    expect(getState().growthTransition).toBeNull()
  })
})

describe('axisSign / recordAxisDiscovery (post-Task-25: honoring the drawn direction)', () => {
  it('starts at the default (both +1), matching the pre-existing positive-octant behavior', () => {
    expect(getState().axisSign).toEqual({ y: 1, z: 1 })
  })

  it('recordAxisDiscovery sets only the named axis, leaving the other untouched', () => {
    getState().recordAxisDiscovery('y', -1)
    expect(getState().axisSign).toEqual({ y: -1, z: 1 })
    getState().recordAxisDiscovery('z', -1)
    expect(getState().axisSign).toEqual({ y: -1, z: -1 })
  })

  it('a later discovery on the same axis overwrites the earlier one', () => {
    getState().recordAxisDiscovery('y', -1)
    getState().recordAxisDiscovery('y', 1)
    expect(getState().axisSign.y).toBe(1)
  })

  it('is NOT reset by advanceStage — a discovery made before Continue must survive into the transition it drives', () => {
    getState().recordAxisDiscovery('y', -1)
    getState().advanceStage() // line -> plane
    expect(getState().axisSign).toEqual({ y: -1, z: 1 })
  })

  it('an earlier discovery survives a later, different axis being discovered', () => {
    getState().recordAxisDiscovery('y', -1)
    getState().advanceStage() // line -> plane
    getState().recordAxisDiscovery('z', -1)
    expect(getState().axisSign).toEqual({ y: -1, z: -1 })
  })

  it('is reset to the default by setStage — a debug jump is never a real discovery', () => {
    getState().recordAxisDiscovery('y', -1)
    getState().setStage('plane')
    expect(getState().axisSign).toEqual({ y: 1, z: 1 })
  })

  it('is reset to the default by reset', () => {
    getState().recordAxisDiscovery('y', -1)
    getState().recordAxisDiscovery('z', -1)
    getState().reset()
    expect(getState().axisSign).toEqual({ y: 1, z: 1 })
  })
})

describe('reset', () => {
  it('restores initial state from anywhere', () => {
    getState().setStage('reveal')
    getState().startDrawing()
    getState().recordAttempt({
      success: true,
      axisContributions: { x: 1, y: 0, z: 0 },
      orthogonalityRatio: 1,
    })
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
