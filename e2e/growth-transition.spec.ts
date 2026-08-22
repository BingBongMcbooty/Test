import { test, expect, type Page } from '@playwright/test'

// Compositor screenshot, not `canvas.toDataURL()` — see orbit.spec.ts's note on
// `preserveDrawingBuffer: false`.
async function canvasSnapshot(page: Page): Promise<Buffer> {
  return page.locator('canvas').screenshot()
}

interface CanvasPoint {
  x: number
  y: number
}

async function canvasCenter(page: Page): Promise<CanvasPoint> {
  const box = await page.locator('canvas').boundingBox()
  if (!box) throw new Error('canvas has no bounding box')
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
}

async function dragFrom(page: Page, from: CanvasPoint, dx: number, dy: number) {
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  await page.mouse.move(from.x + dx, from.y + dy, { steps: 20 })
  await page.mouse.up()
}

// Same empirically-picked pass deltas validation-wiring.spec.ts uses — see that file's
// own notes on why these particular deltas clear/miss ORTHOGONALITY_THRESHOLD from
// canvas center on each stage's real perspective camera.
const LINE_PASS_DELTA = { dx: 0, dy: -200 }
const PLANE_PASS_DELTA = { dx: 100, dy: 0 }
const PLANE_TILT_CLICKS = 3

async function tiltPlaneCamera(page: Page) {
  for (let i = 0; i < PLANE_TILT_CLICKS; i++) {
    await page.getByTestId('camera-control-right').click()
    await page.waitForTimeout(60)
  }
  await page.waitForTimeout(400)
}

type GrowthTransition = { from: string; to: string } | null

async function readGrowthTransition(page: Page): Promise<GrowthTransition> {
  return page.evaluate(
    () =>
      (
        window as unknown as {
          __dimensionsStore: { getState: () => { growthTransition: GrowthTransition } }
        }
      ).__dimensionsStore.getState().growthTransition,
  )
}

// GROWTH_DURATION (math/growth.ts) is 0.6s. A single `canvas.screenshot()` round-trip
// alone measured ~150-200ms in this sandbox's headless Chromium, and a Playwright
// auto-waiting `expect(...).toBeVisible()` call measured ~300ms on top of that (both
// confirmed via a throwaway timing script, not guessed) — comfortably fine on their
// own, but stacking several of them *before* the "still mid-transition" checks below
// eats enough of the budget to make those checks flaky. So the mid-transition checks
// below capture their screenshot immediately after the click, before any other awaited
// call gets a chance to eat into the window, and prove "visibly mid-grow" by comparing
// that one frame against both endpoints (still-on-the-source-stage, and
// fully-settled-on-the-destination-stage) rather than by comparing two separate
// mid-transition frames against each other, which would need the budget twice over.
// Even so, a `requestAnimationFrame`-driven animation this short can still occasionally
// collapse into a single oversized frame under heavy CPU contention (several headless
// browsers rendering WebGL at once, as the full Playwright suite does) — same category
// of sandbox-specific timing flake already documented for other tests (see PROGRESS.md's
// Task 7/23 notes on the frame-rate floor and the fail-cue timing race).
async function waitForGrowthTransitionCleared(page: Page) {
  await expect.poll(() => readGrowthTransition(page), { timeout: 3000 }).toBeNull()
}

test.describe('Task 25: dimension-growth transitions', () => {
  test('Stage 1->2: a real pass + Continue plays a visible growth animation, not an instant swap', async ({
    page,
  }) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))

    await page.goto('/')
    await expect(page.locator('canvas')).toBeVisible()
    await page.waitForTimeout(300)

    const center = await canvasCenter(page)
    await dragFrom(page, center, LINE_PASS_DELTA.dx, LINE_PASS_DELTA.dy)
    await expect(page.getByTestId('stage-continue-button')).toBeVisible()

    // Still Stage 1's real, fully-formed geometry right before the advance.
    const preAdvance = await canvasSnapshot(page)

    await page.getByTestId('stage-continue-button').click()

    // Captured as tightly after the click as possible — see the helper doc comment
    // above for why every other awaited call in this test happens after this pair.
    const rightAfterAdvance = await readGrowthTransition(page)
    expect(rightAfterAdvance).toEqual({ from: 'line', to: 'plane' })
    const mid = await canvasSnapshot(page)
    await page.screenshot({ path: 'e2e/screenshots/growth-line-to-plane-mid.png' })

    // The animation finishes on its own and the plane's normal geometry takes over —
    // same "let it settle" pattern validation-wiring.spec.ts already uses for this
    // exact advance.
    await waitForGrowthTransitionCleared(page)
    await expect(page.getByText('PLANE', { exact: true })).toBeVisible()
    await page.waitForTimeout(200)
    const settled = await canvasSnapshot(page)
    await page.screenshot({ path: 'e2e/screenshots/growth-line-to-plane-settled.png' })

    // The mid-transition frame is neither "still the old shape" nor "already the new
    // one" — a real in-between state, i.e. visibly mid-grow rather than an instant swap.
    expect(mid).not.toEqual(preAdvance)
    expect(mid).not.toEqual(settled)

    expect(errors).toEqual([])
  })

  test('Stage 2->3: a real pass + Continue plays a visible growth animation, not an instant swap', async ({
    page,
  }) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))

    await page.goto('/')
    await page.getByTestId('debug-stage-plane').click()
    await page.waitForTimeout(600)
    await tiltPlaneCamera(page)

    const center = await canvasCenter(page)
    await dragFrom(page, center, PLANE_PASS_DELTA.dx, PLANE_PASS_DELTA.dy)
    await expect(page.getByTestId('stage-continue-button')).toBeVisible()

    const preAdvance = await canvasSnapshot(page)

    await page.getByTestId('stage-continue-button').click()

    const rightAfterAdvance = await readGrowthTransition(page)
    expect(rightAfterAdvance).toEqual({ from: 'plane', to: 'cube' })
    const mid = await canvasSnapshot(page)
    await page.screenshot({ path: 'e2e/screenshots/growth-plane-to-cube-mid.png' })

    await waitForGrowthTransitionCleared(page)
    await expect(page.getByText('CUBE', { exact: true })).toBeVisible()
    await page.waitForTimeout(200)
    const settled = await canvasSnapshot(page)
    await page.screenshot({ path: 'e2e/screenshots/growth-plane-to-cube-settled.png' })

    expect(mid).not.toEqual(preAdvance)
    expect(mid).not.toEqual(settled)

    expect(errors).toEqual([])
  })

  test('debug stage jumps never play the growth animation (only real advanceStage does)', async ({
    page,
  }) => {
    await page.goto('/')
    await page.getByTestId('debug-stage-plane').click()
    await expect(page.getByText('PLANE', { exact: true })).toBeVisible()
    expect(await readGrowthTransition(page)).toBeNull()

    await page.getByTestId('debug-stage-cube').click()
    await expect(page.getByText('CUBE', { exact: true })).toBeVisible()
    expect(await readGrowthTransition(page)).toBeNull()
  })

  test('Stage 3 -> Reveal: no growth animation plays, and the HUD names the shadow/projection view as the reason why', async ({
    page,
  }) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))

    await page.goto('/')
    await page.getByTestId('debug-stage-cube').click()
    await page.waitForTimeout(300)

    // A cube drag first — CubeFeedback.tsx's "I understand" button only renders once
    // `lastResult` is non-null, i.e. after at least one attempt (see cube-decomposition
    // .spec.ts's own setup for this exact same reason).
    const center = await canvasCenter(page)
    await dragFrom(page, center, 150, 0)
    await expect(page.getByTestId('cube-give-up-button')).toBeVisible()

    // Real progression (the "I understand" button) — not the debug jump, so this
    // exercises the actual advanceStage() call a player would trigger at this exact
    // boundary.
    await page.getByTestId('cube-give-up-button').click()
    await expect(page.getByText('REVEAL', { exact: true })).toBeVisible()

    // No growth animation at this boundary, ever — checked immediately and again after
    // a wait, since a transient non-null value would be just as wrong as a persistent one.
    expect(await readGrowthTransition(page)).toBeNull()
    await page.waitForTimeout(600)
    expect(await readGrowthTransition(page)).toBeNull()

    // The new copy explicitly names both the reason (can't grow into an unpointable
    // axis) and the answer (the projection/shadow view), before the player ever
    // touches ui/RevealControls.tsx's "Show projection" toggle.
    const promptText = await page.locator('body').innerText()
    expect(promptText).toContain('shadow')
    expect(promptText).toContain('projection')
    expect(promptText).toContain('grew into the plane')

    await page.screenshot({ path: 'e2e/screenshots/growth-cube-to-reveal-no-animation.png' })

    expect(errors).toEqual([])
  })
})
