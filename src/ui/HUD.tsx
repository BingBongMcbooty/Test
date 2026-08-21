import { useDimensionsStore } from '../state/store'
import { STAGE_CONFIG } from '../state/stageConfig'

const STAGE_LABELS = {
  line: 'Line',
  plane: 'Plane',
  cube: 'Cube',
  reveal: 'Reveal',
  closing: 'Closing',
} as const

export function HUD() {
  const stage = useDimensionsStore((state) => state.stage)
  const { prompt } = STAGE_CONFIG[stage]
  // Task 22: 'closing' gets a deliberate fade-in for its line instead of this HUD's
  // usual instant-cut prompt — `ui/ClosingBeat.tsx` owns rendering it (same text, from
  // the same `STAGE_CONFIG` entry) so it isn't shown twice.
  const showPrompt = stage !== 'closing'

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        padding: '2rem',
        pointerEvents: 'none',
        color: '#e5e4e7',
        fontFamily: 'system-ui, "Segoe UI", Roboto, sans-serif',
        textAlign: 'center',
      }}
    >
      <div style={{ fontSize: '0.8rem', letterSpacing: '0.2em', opacity: 0.6 }}>
        {STAGE_LABELS[stage].toUpperCase()}
      </div>
      {showPrompt && (
        <div style={{ marginTop: '0.5rem', fontSize: '1.1rem', fontWeight: 300 }}>{prompt}</div>
      )}
    </div>
  )
}
