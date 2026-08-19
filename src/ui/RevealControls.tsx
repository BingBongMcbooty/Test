import { useDimensionsStore } from '../state/store'

/**
 * Stage 4's view toggle — swaps `revealView` between the hyperplane slice and the
 * perspective projection without touching the underlying rotation/slice-offset state
 * (`RevealDrag.tsx` is what changes that), so toggling never resets what the player did.
 */
export function RevealControls() {
  const stage = useDimensionsStore((state) => state.stage)
  const revealView = useDimensionsStore((state) => state.revealView)
  const toggleRevealView = useDimensionsStore((state) => state.toggleRevealView)

  if (stage !== 'reveal') return null

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
        {revealView === 'slice' ? 'Show projection' : 'Show slice'}
      </button>
    </div>
  )
}
