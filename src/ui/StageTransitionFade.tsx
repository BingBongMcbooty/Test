import { useEffect, useState } from 'react'
import { useDimensionsStore } from '../state/store'

const FADE_DURATION_MS = 500

/**
 * Task 27: a subtle fade-up-from-black at the two stage boundaries that otherwise get no
 * transition device of their own. Stage 1→2 and 2→3 already play a multi-second geometry
 * growth animation (`scene/StageGrowthTransition.tsx`, Task 25); Stage 3→Reveal
 * deliberately plays *no* growth animation, with copy explaining why (`state/
 * stageConfig.ts`'s `reveal` prompt) — but "no growth animation" and "no transition
 * device at all" aren't the same thing, and that boundary (plus Reveal→Closing, equally
 * bare) currently just cuts the camera and swaps the HUD text instantly. This fills that
 * gap without touching either: a full-screen overlay, the same color as the scene's own
 * background (`Experience.tsx`'s `<color attach="background">`/`index.css`'s `body`), is
 * fully opaque on the first frame of a new stage and eases to fully transparent over
 * `FADE_DURATION_MS` — reads as the new stage fading up out of the same dark the app
 * already opens on, not a flash or a color foreign to the rest of the scene.
 *
 * Deliberately *not* applied to line/plane/cube: those either already have their own
 * transition (the growth animation) or would just add a redundant flash on top of
 * `ui/DimensionWelcome.tsx`'s own fade-in beat. `pointerEvents: 'none'` throughout means
 * this can never block a click even while still fading, so no test or interaction needs
 * to wait for it.
 *
 * Unlike `growthTransition`/`revealWarmupActive`/`showStageWelcome`, this deliberately
 * does *not* distinguish a real `advanceStage()` arrival from a `setStage()` debug jump —
 * `ui/ClosingBeat.tsx`'s own fade-in already treats every arrival at 'closing' the same
 * way regardless of how the player got there, and mirroring that precedent here (rather
 * than adding a new store field only this component would read) keeps every debug-jump
 * Playwright test that lands on reveal/closing seeing the same overlay a real playthrough
 * would, which is the more honest thing for a purely-visual polish pass to render anyway.
 */
export function StageTransitionFade() {
  const stage = useDimensionsStore((state) => state.stage)
  if (stage !== 'reveal' && stage !== 'closing') return null
  // `key={stage}` remounts (and so restarts the fade) only on a genuine boundary crossing
  // — toggling `revealView` while already on 'reveal' leaves the key, and this component,
  // untouched.
  return <StageTransitionFadeContent key={stage} />
}

function StageTransitionFadeContent() {
  const [faded, setFaded] = useState(false)

  useEffect(() => {
    const raf = requestAnimationFrame(() => setFaded(true))
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: '#0a0a0f',
        opacity: faded ? 0 : 1,
        transition: `opacity ${FADE_DURATION_MS}ms ease-out`,
        pointerEvents: 'none',
      }}
    />
  )
}
