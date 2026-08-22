import { useDimensionsStore } from '../state/store'

/**
 * Direct user flag (post-Task-22 playtest): `ChiralityDemo.tsx`'s box-and-cylinder hand
 * is a placeholder shape standing in for the real geometry the demo deserves — asymmetric
 * enough to prove the mirror-flip math, but not something the app should ship as-is. This
 * badge exists so nobody (including a future session skimming the running app rather than
 * PLAN.md) mistakes the current model for a finished piece. Remove once the model itself
 * is redone as a smooth, properly modeled glove — see PLAN.md's tunables note on the
 * chirality demo's geometry.
 */
export function ChiralityPrototypeBadge() {
  const stage = useDimensionsStore((state) => state.stage)
  const revealView = useDimensionsStore((state) => state.revealView)

  if (stage !== 'reveal' || revealView !== 'chirality') return null

  return (
    <div
      data-testid="chirality-prototype-badge"
      style={{
        position: 'absolute',
        top: '1.5rem',
        left: '1.5rem',
        padding: '0.35rem 0.7rem',
        fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
        fontSize: '0.68rem',
        letterSpacing: '0.06em',
        color: '#ffb454',
        background: 'rgba(10, 10, 15, 0.55)',
        border: '1px solid rgba(255, 180, 84, 0.45)',
        borderRadius: '0.5rem',
        pointerEvents: 'none',
      }}
    >
      PROTOTYPE MODEL — placeholder shape, not final
    </div>
  )
}
