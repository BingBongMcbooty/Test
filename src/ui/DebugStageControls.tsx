import { useDimensionsStore } from '../state/store'
import { STAGE_ORDER } from '../state/stageConfig'

/**
 * Throwaway stage-cycling buttons — there's no real drag interaction to advance the
 * stage machine until Tasks 7-10, so this is how Task 5's Playwright verification (and
 * anyone poking around in the browser) exercises the stage router in the meantime.
 * Delete once real interaction lands.
 */
export function DebugStageControls() {
  const stage = useDimensionsStore((state) => state.stage)
  const setStage = useDimensionsStore((state) => state.setStage)

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        width: '100%',
        display: 'flex',
        justifyContent: 'center',
        gap: '0.5rem',
        padding: '1.5rem',
        fontFamily: 'system-ui, "Segoe UI", Roboto, sans-serif',
      }}
    >
      {STAGE_ORDER.map((candidate) => (
        <button
          key={candidate}
          type="button"
          data-testid={`debug-stage-${candidate}`}
          onClick={() => setStage(candidate)}
          style={{
            padding: '0.4rem 0.8rem',
            fontSize: '0.75rem',
            background: candidate === stage ? '#e5e4e7' : 'transparent',
            color: candidate === stage ? '#0a0a0f' : '#e5e4e7',
            border: '1px solid #e5e4e7',
            borderRadius: '999px',
            cursor: 'pointer',
          }}
        >
          {candidate}
        </button>
      ))}
    </div>
  )
}
