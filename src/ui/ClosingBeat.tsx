import { useEffect, useState } from 'react'
import { useDimensionsStore } from '../state/store'
import { STAGE_CONFIG } from '../state/stageConfig'

/** Milliseconds of delay before the fade-in starts, then the CSS transition duration. */
const FADE_DELAY_MS = 200
const FADE_DURATION_MS = 1200

/**
 * Task 22: the closing beat. `HUD.tsx` renders every other stage's prompt instantly
 * (an "instant cut," matching this app's established stage-transition feel) — this one
 * line is deliberately the exception, since it's the whole point the app has been
 * building to, not just another stage label. `HUD.tsx` skips the 'closing' prompt (see
 * its own note) so this component owns that line instead, plus the restart button that
 * returns the player to Stage 1 via the store's existing `reset()` (already exercised by
 * `store.test.ts`'s 'reset' suite).
 *
 * The fade is a plain mount-triggered CSS opacity transition (`visible` flips true one
 * tick after mount, via `requestAnimationFrame` rather than the delayed `useState`
 * initializer so the browser actually paints the `opacity: 0` frame first — flipping it
 * synchronously would collapse to a no-op transition) — no timer-based auto-advance
 * anywhere here, matching every other "when do we move on" decision in this app being
 * player-driven, not the app's. Split into an outer stage gate and an inner content
 * component so `visible` naturally resets by unmounting/remounting on every entry into
 * 'closing', rather than needing an effect to reset it back to `false` on the way out —
 * setting state directly inside an effect for that purpose is exactly what
 * `eslint-plugin-react-hooks` flags (same class of check Tasks 7/9/10's notes describe
 * for hook-returned-value mutation, here for setState-in-effect instead).
 */
export function ClosingBeat() {
  const stage = useDimensionsStore((state) => state.stage)
  if (stage !== 'closing') return null
  return <ClosingBeatContent />
}

function ClosingBeatContent() {
  const reset = useDimensionsStore((state) => state.reset)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      window.setTimeout(() => setVisible(true), FADE_DELAY_MS)
    })
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '2.5rem',
        fontFamily: 'system-ui, "Segoe UI", Roboto, sans-serif',
        pointerEvents: 'none',
      }}
    >
      <div
        data-testid="closing-line"
        style={{
          maxWidth: '32rem',
          padding: '0 2rem',
          fontSize: '1.3rem',
          fontWeight: 300,
          textAlign: 'center',
          color: '#e5e4e7',
          opacity: visible ? 1 : 0,
          transition: `opacity ${FADE_DURATION_MS}ms ease-out`,
        }}
      >
        {STAGE_CONFIG.closing.prompt}
      </div>
      <button
        type="button"
        data-testid="restart-button"
        onClick={() => reset()}
        style={{
          padding: '0.6rem 1.5rem',
          fontSize: '0.85rem',
          letterSpacing: '0.05em',
          background: 'transparent',
          color: '#e5e4e7',
          border: '1px solid #e5e4e7',
          borderRadius: '999px',
          cursor: 'pointer',
          opacity: visible ? 0.85 : 0,
          transition: `opacity ${FADE_DURATION_MS}ms ease-out`,
          pointerEvents: 'auto',
        }}
      >
        Start over
      </button>
    </div>
  )
}
