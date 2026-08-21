import { useDimensionsStore } from '../state/store'
import type { RevealView } from '../state/stageConfig'

/** Task 21: each button label names the *next* view a click switches to. */
const NEXT_VIEW_LABEL: Record<RevealView, string> = {
  slice: 'Show projection',
  projection: 'Show chirality demo',
  chirality: 'Show slice',
}

/**
 * Stage 4's view toggle — cycles `revealView` through the hyperplane slice, the
 * perspective projection, and the chirality/mirror-flip demo (Task 21), without touching
 * the underlying rotation/slice-offset state (`RevealDrag.tsx` is what changes that), so
 * toggling never resets what the player did.
 */
export function RevealControls() {
  const stage = useDimensionsStore((state) => state.stage)
  const revealWarmupActive = useDimensionsStore((state) => state.revealWarmupActive)
  const revealView = useDimensionsStore((state) => state.revealView)
  const toggleRevealView = useDimensionsStore((state) => state.toggleRevealView)

  // Task 20: the cone warm-up plays first and has no view toggle of its own — see
  // `ui/SliceWarmupControls.tsx`.
  if (stage !== 'reveal' || revealWarmupActive) return null

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
        gap: '0.6rem',
        fontFamily: 'system-ui, "Segoe UI", Roboto, sans-serif',
      }}
    >
      <div style={{ fontSize: '0.7rem', letterSpacing: '0.04em', opacity: 0.55, color: '#e5e4e7' }}>
        drag to rotate · hold shift to rotate the other way · drag vertically to slice
      </div>
      <button
        type="button"
        data-testid="reveal-view-toggle"
        onClick={() => toggleRevealView()}
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
        {NEXT_VIEW_LABEL[revealView]}
      </button>
    </div>
  )
}
