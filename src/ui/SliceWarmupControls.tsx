import { useDimensionsStore } from '../state/store'

/**
 * Task 20: hint text + skip button for `scene/SliceWarmup.tsx`'s cone-slicing warm-up.
 * Genuinely skippable from the moment it appears (no forced minimum play time) — PLAN.md
 * leaves "how obviously skippable" to this task's own judgment, and a persistent,
 * always-clickable button is the least ambiguous way to satisfy "skippable."
 */
export function SliceWarmupControls() {
  const stage = useDimensionsStore((state) => state.stage)
  const revealWarmupActive = useDimensionsStore((state) => state.revealWarmupActive)
  const finishRevealWarmup = useDimensionsStore((state) => state.finishRevealWarmup)

  if (stage !== 'reveal' || !revealWarmupActive) return null

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
        drag to tilt the cone · drag vertically to move the cutting plane
      </div>
      <button
        type="button"
        data-testid="slice-warmup-skip"
        onClick={() => finishRevealWarmup()}
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
        Continue to the 4th dimension
      </button>
    </div>
  )
}
