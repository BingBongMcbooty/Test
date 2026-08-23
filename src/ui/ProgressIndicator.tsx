import { useDimensionsStore } from '../state/store'
import { STAGE_ORDER, type Stage } from '../state/stageConfig'

const STAGE_INITIAL: Record<Stage, string> = {
  line: '1',
  plane: '2',
  cube: '3',
  reveal: '4',
  closing: '·',
}

/**
 * Task 27: a small, non-interactive readout of where the player is in `STAGE_ORDER` —
 * the app never had one before this, beyond `ui/DebugStageControls.tsx`'s own current-
 * stage highlight, which is dev-only test scaffolding (its own doc comment says so) and
 * sits at the very bottom of the screen doubling as a set of stage-jump buttons, not a
 * readout meant for the actual player.
 *
 * Placed top-left — the exact corner `ui/ChiralityPrototypeBadge.tsx` used to occupy
 * before this same task removed it — so it flanks `ui/HUD.tsx`'s centered header
 * opposite `ui/DimensionPanel.tsx`'s top-right corner, matching the app's existing
 * "status row along the top" layout grammar rather than introducing a new one.
 *
 * A step reads as done (filled, dim) once `STAGE_ORDER`'s index of the current stage has
 * passed it, current (filled, bright accent) at the matching index, and upcoming (hollow)
 * after it — plain index comparison against `STAGE_ORDER`, not a new store field, since
 * this app's progression is already strictly linear (`nextStage`/`STAGE_ORDER` are the
 * single source of truth every other stage-order-aware piece of code already reads).
 */
export function ProgressIndicator() {
  const stage = useDimensionsStore((state) => state.stage)
  const currentIndex = STAGE_ORDER.indexOf(stage)

  return (
    <div
      data-testid="progress-indicator"
      style={{
        position: 'absolute',
        top: '1.5rem',
        left: '1.5rem',
        display: 'flex',
        alignItems: 'center',
        gap: '0.35rem',
        pointerEvents: 'none',
      }}
    >
      {STAGE_ORDER.map((candidate, index) => {
        const status = index < currentIndex ? 'done' : index === currentIndex ? 'current' : 'upcoming'
        return (
          <div key={candidate} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <div
              data-testid={`progress-step-${candidate}`}
              data-status={status}
              style={{
                width: status === 'current' ? '1.35rem' : '1rem',
                height: status === 'current' ? '1.35rem' : '1rem',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
                fontSize: '0.6rem',
                color: status === 'upcoming' ? 'rgba(229, 228, 231, 0.55)' : '#0a0a0f',
                background:
                  status === 'current'
                    ? '#ffb454'
                    : status === 'done'
                      ? 'rgba(229, 228, 231, 0.65)'
                      : 'transparent',
                border:
                  status === 'upcoming' ? '1px solid rgba(229, 228, 231, 0.4)' : '1px solid transparent',
                boxShadow: status === 'current' ? '0 0 0.5rem rgba(255, 180, 84, 0.6)' : 'none',
                transition: 'all 320ms ease',
              }}
            >
              {STAGE_INITIAL[candidate]}
            </div>
            {index < STAGE_ORDER.length - 1 && (
              <div
                style={{
                  width: '0.85rem',
                  height: '1px',
                  background: index < currentIndex ? 'rgba(229, 228, 231, 0.65)' : 'rgba(229, 228, 231, 0.25)',
                  transition: 'background 320ms ease',
                }}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
