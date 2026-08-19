import { useEffect } from 'react'
import { FAIL_CUE_DURATION } from '../scene/FailCueArrow'
import { useDimensionsStore } from '../state/store'
import { CUBE_ATTEMPTS_BEFORE_REVEAL } from '../state/stageConfig'

const AXES = ['x', 'y', 'z'] as const

function formatPercent(fraction: number): string {
  return `${Math.round(fraction * 100)}%`
}

/**
 * Stage 3's decomposition feedback (Task 12): every cube-stage drag is a structural
 * fail (see stageConfig.ts's note on `CUBE_ATTEMPTS_BEFORE_REVEAL`), so instead of a
 * pass/fail outcome the player gets to see *why* — each axis's share of the drag they
 * just made, straight from `evaluateAttempt`'s `axisContributions` (already computed
 * for every stage, per Task 3/4's notes). An "I understand" button (PLAN.md: appears
 * after the first failed attempt) lets the player move on early; otherwise the app
 * advances on its own after `CUBE_ATTEMPTS_BEFORE_REVEAL` attempts. Per the "no
 * artificial lock" locked decision, this never disables the drag itself — `ArrowDrag`
 * keeps accepting attempts right up until the stage actually changes.
 */
export function CubeFeedback() {
  const stage = useDimensionsStore((state) => state.stage)
  const attempts = useDimensionsStore((state) => state.attempts)
  const lastResult = useDimensionsStore((state) => state.lastResult)
  const advanceStage = useDimensionsStore((state) => state.advanceStage)

  // Delayed by the same duration as ArrowDrag's fail cue so the last attempt's cue
  // finishes flashing/fading before the camera transitions away.
  useEffect(() => {
    if (stage !== 'cube' || attempts < CUBE_ATTEMPTS_BEFORE_REVEAL) return
    const timeout = window.setTimeout(() => advanceStage(), FAIL_CUE_DURATION * 1000)
    return () => window.clearTimeout(timeout)
  }, [stage, attempts, advanceStage])

  if (stage !== 'cube' || !lastResult) return null

  return (
    <div
      style={{
        position: 'absolute',
        bottom: '6rem',
        left: 0,
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '0.75rem',
        fontFamily: 'system-ui, "Segoe UI", Roboto, sans-serif',
        color: '#e5e4e7',
      }}
    >
      <div
        data-testid="cube-decomposition"
        style={{
          display: 'flex',
          gap: '1.25rem',
          fontSize: '0.85rem',
          letterSpacing: '0.05em',
          opacity: 0.85,
        }}
      >
        {AXES.map((axis) => (
          <span key={axis}>
            {axis} {formatPercent(lastResult.axisContributions[axis])}
          </span>
        ))}
      </div>
      <button
        type="button"
        data-testid="cube-give-up-button"
        onClick={() => advanceStage()}
        style={{
          padding: '0.4rem 1rem',
          fontSize: '0.75rem',
          background: 'transparent',
          color: '#e5e4e7',
          border: '1px solid #e5e4e7',
          borderRadius: '999px',
          cursor: 'pointer',
        }}
      >
        I understand
      </button>
    </div>
  )
}
