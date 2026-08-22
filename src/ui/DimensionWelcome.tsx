import { useEffect, useState } from 'react'
import { useDimensionsStore } from '../state/store'

const DIMENSION_LABELS = {
  line: '1st',
  plane: '2nd',
  cube: '3rd',
} as const

type WelcomeStage = keyof typeof DIMENSION_LABELS

/** Milliseconds before the fade-in starts, how long it holds, then the fade-out duration. */
const FADE_IN_DELAY_MS = 150
const HOLD_MS = 1800
const FADE_DURATION_MS = 700

/**
 * Post-Task-18-removal beat: a pass now auto-advances straight through the growth
 * animation with no Continue button to pause the player on (see `ArrowDrag.tsx`/
 * `state/store.ts`) — this replaces that pause with something that doesn't require a
 * click: a brief "Welcome to the Nth dimension" line that fades in as the shape grows,
 * holds, then fades back out on its own. Only Stage 1/2/3 ever get one — landing on
 * `reveal` is deliberately silent here, the same way it deliberately gets no growth
 * animation (see PLAN.md's "why a growth animation... and why not across the Stage 3->4
 * boundary"): there's no 4th dimension to welcome the player *into*, and doing so would
 * directly contradict the point the app is about to make at exactly that boundary.
 *
 * Gated on `state/store.ts`'s `showStageWelcome`, which is only ever true from a real
 * arrival (the initial `line` value, or `advanceStage()` landing on plane/cube) — never
 * a `setStage()` debug jump, mirroring `growthTransition`'s/`revealWarmupActive`'s own
 * "only real progression triggers this" rule.
 *
 * Split into an outer stage gate and an inner `key`ed content component, same trick
 * `ui/ClosingBeat.tsx` uses, so the fade lifecycle naturally restarts on every fresh
 * arrival by remounting rather than needing an effect to reset local state on the way
 * out. Unlike `ClosingBeat`'s fade-in-and-stay, this one also fades back out on its own
 * timer and calls `dismissStageWelcome()` once that's finished, so the store flag
 * reflects reality rather than staying stuck `true` after the banner's already gone.
 */
export function DimensionWelcome() {
  const stage = useDimensionsStore((state) => state.stage)
  const showStageWelcome = useDimensionsStore((state) => state.showStageWelcome)

  if (!showStageWelcome || !isWelcomeStage(stage)) return null
  return <DimensionWelcomeContent key={stage} stage={stage} />
}

function isWelcomeStage(stage: string): stage is WelcomeStage {
  return stage === 'line' || stage === 'plane' || stage === 'cube'
}

function DimensionWelcomeContent({ stage }: { stage: WelcomeStage }) {
  const dismissStageWelcome = useDimensionsStore((state) => state.dismissStageWelcome)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      window.setTimeout(() => setVisible(true), FADE_IN_DELAY_MS)
    })
    const hideTimeout = window.setTimeout(() => setVisible(false), FADE_IN_DELAY_MS + HOLD_MS)
    const dismissTimeout = window.setTimeout(
      () => dismissStageWelcome(),
      FADE_IN_DELAY_MS + HOLD_MS + FADE_DURATION_MS,
    )
    return () => {
      cancelAnimationFrame(raf)
      window.clearTimeout(hideTimeout)
      window.clearTimeout(dismissTimeout)
    }
  }, [dismissStageWelcome])

  return (
    // Dead-center (both axes) collides with the shape itself — every stage frames its
    // shape near screen center (cameraFraming.ts), and Stage 1's own dotted-line grid
    // was confirmed by eye to visibly cut straight through dead-center text. `bottom:
    // 6rem` instead reuses the exact spot Task 18's now-removed StageContinue.tsx
    // occupied — already proven clear of every stage's shape, the D-pad, and the
    // stage-debug row beneath it.
    <div
      style={{
        position: 'absolute',
        bottom: '6rem',
        left: 0,
        width: '100%',
        display: 'flex',
        justifyContent: 'center',
        pointerEvents: 'none',
      }}
    >
      <div
        data-testid="dimension-welcome"
        style={{
          fontFamily: 'system-ui, "Segoe UI", Roboto, sans-serif',
          fontSize: '1.3rem',
          fontWeight: 300,
          letterSpacing: '0.03em',
          color: '#e5e4e7',
          textAlign: 'center',
          opacity: visible ? 1 : 0,
          transition: `opacity ${FADE_DURATION_MS}ms ease-out`,
        }}
      >
        Welcome to the {DIMENSION_LABELS[stage]} dimension
      </div>
    </div>
  )
}
