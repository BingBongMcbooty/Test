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
  // the same `STAGE_CONFIG` entry) so it isn't shown twice. Task 27 considered widening
  // this instant-cut into a fade for every stage's prompt, and deliberately didn't:
  // the prompt is the one line this app has always cut instantly (see this comment's own
  // history), and `ui/StageTransitionFade.tsx` now covers the two boundaries (3→Reveal,
  // Reveal→Closing) that most needed *some* transition device without touching this
  // established feel. Only the small label above it gets the new subtle fade below.
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
      <div
        key={stage}
        style={{
          fontSize: '0.78rem',
          fontWeight: 500,
          letterSpacing: '0.28em',
          opacity: 0.6,
          animation: 'hud-label-rise 420ms ease-out both',
        }}
      >
        {STAGE_LABELS[stage].toUpperCase()}
      </div>
      {showPrompt && (
        <div
          style={{
            // Task 26: Task 25's reveal-stage copy is long enough to wrap to 3 lines,
            // and this div previously had no width cap — at `width: 100%` (this
            // container's own width) its wrapped lines ran the full canvas width and
            // collided with `DimensionPanel`'s fixed top-right corner (`right: 1.5rem`,
            // `maxWidth: 14rem`, see that file's own `panelContainerStyle` note). Task
            // 24 already capped the *panel's* width for the mirror-image version of
            // this problem (the panel growing into the header); this caps the
            // *header's* width instead, so a long prompt wraps narrower and stays
            // clear of the panel's corner regardless of which stage's copy is showing.
            maxWidth: '40rem',
            margin: '0.6rem auto 0',
            fontSize: '1.15rem',
            fontWeight: 300,
            lineHeight: 1.5,
          }}
        >
          {prompt}
        </div>
      )}
    </div>
  )
}
