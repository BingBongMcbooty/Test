import { useDimensionsStore } from '../state/store'

/**
 * Task 22: lets the player leave Stage 4 whenever they're ready. Reveal has no
 * pass/fail condition to gate on (unlike Stage 3's `CubeFeedback` attempt threshold) —
 * it's pure exploration across three views (slice/projection/chirality),
 * so per PLAN.md's "on a continue click" option, this is a plain manual button, always
 * available once the warm-up is done, same "no artificial lock" precedent as
 * `SliceWarmupControls`'s skip button right before it in the flow.
 */
export function ClosingContinue() {
  const stage = useDimensionsStore((state) => state.stage)
  const revealWarmupActive = useDimensionsStore((state) => state.revealWarmupActive)
  const advanceStage = useDimensionsStore((state) => state.advanceStage)

  if (stage !== 'reveal' || revealWarmupActive) return null

  return (
    <div
      style={{
        // Every other reveal-stage overlay already claims a region: DimensionPanel
        // (top-right), CameraDirectionalControls (bottom-right), RevealControls'
        // view-toggle + hint (bottom-center, `bottom: 6rem`) over DebugStageControls'
        // stage-jump row (bottom-center, `bottom: 0`). Bottom-left, mirroring
        // CameraDirectionalControls' bottom offset, is the one corner nothing else uses.
        position: 'absolute',
        bottom: '5rem',
        left: '1.5rem',
        fontFamily: 'system-ui, "Segoe UI", Roboto, sans-serif',
      }}
    >
      <button
        type="button"
        data-testid="closing-continue-button"
        onClick={() => advanceStage()}
        style={{
          padding: '0.4rem 1rem',
          fontSize: '0.75rem',
          background: 'transparent',
          color: '#e5e4e7',
          border: '1px solid #e5e4e7',
          borderRadius: '999px',
          cursor: 'pointer',
          opacity: 0.85,
        }}
      >
        I've seen enough
      </button>
    </div>
  )
}
