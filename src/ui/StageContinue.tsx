import { useDimensionsStore } from '../state/store'

/**
 * Task 18: Stages 1-2 no longer auto-advance the instant a drag passes (direct
 * playtest feedback: it didn't give the player "enough of a chance to play with it")
 * — mirrors `ui/CubeFeedback.tsx`'s "I understand" precedent, the established pattern
 * in this codebase for "don't advance the instant the condition is met." `ArrowDrag.tsx`
 * sets `stagePassed` on the first passing drag this stage instead of calling
 * `advanceStage()` directly; this component then shows a manual "Continue" button.
 * Per the "no artificial lock" locked decision, `ArrowDrag` keeps accepting attempts
 * (pass or fail) the whole time this is showing — `stagePassed` is untouched by later
 * fails, so a subsequent failed attempt doesn't hide the button.
 *
 * Manual button only, no fallback auto-advance (unlike `CubeFeedback`'s belt-and-braces
 * approach) — PLAN.md left the exact mechanism to this task's judgment either way, and
 * a forced auto-advance here would undercut the whole point: the player already
 * succeeded, so lingering is a deliberate choice, not something the app should time out.
 */
export function StageContinue() {
  const stage = useDimensionsStore((state) => state.stage)
  const stagePassed = useDimensionsStore((state) => state.stagePassed)
  const advanceStage = useDimensionsStore((state) => state.advanceStage)

  if ((stage !== 'line' && stage !== 'plane') || !stagePassed) return null

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
        data-testid="stage-continue-message"
        style={{ fontSize: '0.85rem', letterSpacing: '0.05em', opacity: 0.85 }}
      >
        You found a way out. Keep exploring, or continue.
      </div>
      <button
        type="button"
        data-testid="stage-continue-button"
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
        Continue
      </button>
    </div>
  )
}
