import { create } from 'zustand'
import type { AttemptResult } from '../math/validation'
import { type Stage, nextStage } from './stageConfig'

interface DimensionsState {
  stage: Stage
  attempts: number
  isDrawing: boolean
  lastResult: AttemptResult | null

  setStage: (stage: Stage) => void
  advanceStage: () => void
  startDrawing: () => void
  endDrawing: () => void
  recordAttempt: (result: AttemptResult) => void
  reset: () => void
}

const initialState = {
  stage: 'line' as Stage,
  attempts: 0,
  isDrawing: false,
  lastResult: null as AttemptResult | null,
}

export const useDimensionsStore = create<DimensionsState>((set) => ({
  ...initialState,

  setStage: (stage) => set({ stage, attempts: 0, isDrawing: false, lastResult: null }),

  advanceStage: () =>
    set((state) => ({
      stage: nextStage(state.stage),
      attempts: 0,
      isDrawing: false,
      lastResult: null,
    })),

  startDrawing: () => set({ isDrawing: true }),

  endDrawing: () => set({ isDrawing: false }),

  recordAttempt: (result) =>
    set((state) => ({
      lastResult: result,
      attempts: state.attempts + 1,
      isDrawing: false,
    })),

  reset: () => set({ ...initialState }),
}))
