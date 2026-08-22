import { test, expect, type Page } from '@playwright/test'

// Task 26: one Playwright test scripting the entire path PLAN.md's deliverable
// describes — Stage 1 pass -> Stage 2 pass -> a few Stage 3 fails -> give up ->
// Stage 4 (slicing warm-up -> tesseract -> chirality demo) -> closing -> restart —
// as a safety net for future changes. Helpers below are deliberately duplicated
// from the specs they're borrowed from (validation-wiring.spec.ts,
// growth-transition.spec.ts, cube-decomposition.spec.ts, slice-warmup.spec.ts,
// chirality.spec.ts, closing.spec.ts) rather than factored into a shared module —
// matching this codebase's own established per-spec-file convention (every one of
// those files keeps its own copies of `canvasCenter`/`dragFrom`/etc. already).

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

// Same empirically-derived deltas validation-wiring.spec.ts/growth-transition.spec.ts
// already use — see those files' own notes for how each was swept against the real
// perspective camera on each stage.
const LINE_PASS_DELTA = { dx: 0, dy: -200 }
const PLANE_PASS_DELTA = { dx: 100, dy: 0 }
const PLANE_TILT_CLICKS = 3
const CUBE_DRAG_DELTA = { dx: 140, dy: 90 }

async function tiltPlaneCamera(page: Page) {
  for (let i = 0; i < PLANE_TILT_CLICKS; i++) {
    await page.getByTestId('camera-control-right').click()
    await page.waitForTimeout(60)
  }
  await page.waitForTimeout(400)
}

type GrowthTransition = { from: string; to: string } | null

interface StoreState {
  stage: string
  attempts: number
  revealWarmupActive: boolean
  growthTransition: GrowthTransition
  revealView: 'slice' | 'projection' | 'chirality'
  revealRotationXW: number
  revealRotationYW: number
  revealSliceW0: number
}

function readStoreState(page: Page): Promise<StoreState> {
  return page.evaluate(() =>
    (
      window as unknown as { __dimensionsStore: { getState: () => StoreState } }
    ).__dimensionsStore.getState(),
  )
}

// Same poll-for-null pattern growth-transition.spec.ts's own
// `waitForGrowthTransitionCleared` uses — GROWTH_DURATION is 2.5s (raised from an
// original 0.6s, see that file's/math/growth.ts's own notes), clamped against a
// single-frame-swallows-the-whole-animation race (see PROGRESS.md's Task 25 notes), so
// polling rather than a fixed wait is what that file's own precedent settled on. Timeout
// sized to the 2.5s duration with headroom, same as growth-transition.spec.ts's copy of
// this helper.
async function waitForGrowthTransitionCleared(page: Page) {
  await expect
    .poll(async () => (await readStoreState(page)).growthTransition, { timeout: 6000 })
    .toBeNull()
}

test.describe('Task 26: full playthrough regression', () => {
  test('Stage 1 pass -> Stage 2 pass -> Stage 3 fails+give up -> Stage 4 (warm-up, tesseract, chirality) -> closing -> restart', async ({
    page,
  }) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))

    await page.goto('/')
    await expect(page.locator('canvas')).toBeVisible()
    await page.waitForTimeout(300)
    await expect(page.getByText('LINE', { exact: true })).toBeVisible()
    await page.screenshot({ path: 'e2e/screenshots/full-playthrough-01-line.png' })

    // --- Stage 1: pass, keep exploring is implicit (Continue shows, not forced),
    // then the real advance plays Task 25's growth animation into Stage 2. ---
    let center = await canvasCenter(page)
    await dragFrom(page, center, LINE_PASS_DELTA.dx, LINE_PASS_DELTA.dy)
    await expect(page.getByTestId('stage-continue-button')).toBeVisible()

    await page.getByTestId('stage-continue-button').click()
    expect((await readStoreState(page)).growthTransition).toEqual({ from: 'line', to: 'plane' })
    await waitForGrowthTransitionCleared(page)
    await expect(page.getByText('PLANE', { exact: true })).toBeVisible()
    await page.waitForTimeout(300)
    await page.screenshot({ path: 'e2e/screenshots/full-playthrough-02-plane.png' })

    // --- Stage 2: dead-on rest means z is unreachable until the camera is tilted via
    // the on-screen button (Task 17); then pass, continue, and the plane->cube growth
    // animation plays. ---
    await tiltPlaneCamera(page)
    center = await canvasCenter(page)
    await dragFrom(page, center, PLANE_PASS_DELTA.dx, PLANE_PASS_DELTA.dy)
    await expect(page.getByTestId('stage-continue-button')).toBeVisible()

    await page.getByTestId('stage-continue-button').click()
    expect((await readStoreState(page)).growthTransition).toEqual({ from: 'plane', to: 'cube' })
    await waitForGrowthTransitionCleared(page)
    await expect(page.getByText('CUBE', { exact: true })).toBeVisible()
    await page.waitForTimeout(300)
    await page.screenshot({ path: 'e2e/screenshots/full-playthrough-03-cube.png' })

    // --- Stage 3: every cube drag is a structural fail (occupiedAxes = x/y/z) — a
    // couple of failed attempts (well under CUBE_ATTEMPTS_BEFORE_REVEAL = 3, so the
    // auto-advance never fires and this exercises the "give up" path specifically),
    // then "I understand" (real advanceStage() progression, not the debug jump — this
    // is the only path that sets revealWarmupActive and skips the growth animation). ---
    center = await canvasCenter(page)
    for (let i = 0; i < 2; i++) {
      await dragFrom(page, center, CUBE_DRAG_DELTA.dx, CUBE_DRAG_DELTA.dy)
      await page.waitForTimeout(150)
    }
    await expect(page.getByText('CUBE', { exact: true })).toBeVisible()
    const decomposition = page.getByTestId('cube-decomposition')
    await expect(decomposition).toBeVisible()
    const decompositionText = await decomposition.innerText()
    const percentages = [...decompositionText.matchAll(/(\d+)%/g)].map((m) => Number(m[1]))
    expect(percentages).toHaveLength(3)
    expect(percentages.some((pct) => pct > 0)).toBe(true)

    const giveUpButton = page.getByTestId('cube-give-up-button')
    await expect(giveUpButton).toBeVisible()
    await giveUpButton.click()

    await expect(page.getByText('REVEAL', { exact: true })).toBeVisible()
    // No growth animation at the 3->Reveal boundary (Task 25's deliberate exception),
    // and the copy names the shadow/projection metaphor by name before the player
    // meets the toggle button.
    expect((await readStoreState(page)).growthTransition).toBeNull()
    expect((await readStoreState(page)).revealWarmupActive).toBe(true)
    const revealPromptText = await page.locator('body').innerText()
    expect(revealPromptText).toContain('shadow')
    expect(revealPromptText).toContain('projection')
    await page.screenshot({ path: 'e2e/screenshots/full-playthrough-04-reveal-intro.png' })

    // --- Stage 4a: the 3D slicing warm-up (Task 20) — a cone gets cut by a moving 2D
    // plane before the player meets the same interaction one dimension up. ---
    await expect(page.getByTestId('slice-warmup-skip')).toBeVisible()
    await expect(page.getByTestId('reveal-view-toggle')).toHaveCount(0)
    center = await canvasCenter(page)
    await dragFrom(page, center, 120, -90)
    await page.waitForTimeout(100)
    await page.screenshot({ path: 'e2e/screenshots/full-playthrough-05-slice-warmup.png' })

    await page.getByTestId('slice-warmup-skip').click()
    await page.waitForTimeout(400)
    expect((await readStoreState(page)).revealWarmupActive).toBe(false)

    // --- Stage 4b: the tesseract itself, slice view first (the default `revealView`). ---
    await expect(page.getByTestId('reveal-view-toggle')).toBeVisible()
    await expect(page.getByTestId('reveal-view-toggle')).toHaveText('Show projection')
    center = await canvasCenter(page)
    await dragFrom(page, center, 90, -60)
    await page.waitForTimeout(100)
    const afterSliceDrag = await readStoreState(page)
    expect(afterSliceDrag.revealView).toBe('slice')
    expect(afterSliceDrag.revealRotationXW).not.toBe(0)
    expect(afterSliceDrag.revealSliceW0).not.toBe(0)
    await page.screenshot({ path: 'e2e/screenshots/full-playthrough-06-reveal-slice.png' })

    // --- Stage 4c: toggle to projection view — same shared rotation/slice state,
    // different lens (Task 14/19's "one shared piece of 4D state, two views"). ---
    await page.getByTestId('reveal-view-toggle').click()
    await expect(page.getByTestId('reveal-view-toggle')).toHaveText('Show chirality demo')
    expect((await readStoreState(page)).revealView).toBe('projection')
    await page.waitForTimeout(200)
    await page.screenshot({ path: 'e2e/screenshots/full-playthrough-07-reveal-projection.png' })

    // --- Stage 4d: the chirality/mirror-flip demo (Task 21) — same drag control,
    // third `revealView`. A modest drag is enough to show the mid-turn warp; this test
    // isn't re-proving the exact-180-degree mirror math (chirality.spec.ts already
    // does), just exercising that the demo is reachable and responds live. ---
    await page.getByTestId('reveal-view-toggle').click()
    await expect(page.getByTestId('reveal-view-toggle')).toHaveText('Show slice')
    expect((await readStoreState(page)).revealView).toBe('chirality')
    await expect(page.getByTestId('dimension-chirality-note')).toBeVisible()
    await page.screenshot({ path: 'e2e/screenshots/full-playthrough-08-chirality-before.png' })

    center = await canvasCenter(page)
    await dragFrom(page, center, 130, 0)
    await page.waitForTimeout(100)
    const afterChiralityDrag = await readStoreState(page)
    // Rotation state is shared/cumulative across views (not reset by toggling), so this
    // drag adds on top of the slice-view drag above rather than starting fresh.
    expect(afterChiralityDrag.revealRotationXW).toBeGreaterThan(afterSliceDrag.revealRotationXW)
    await page.screenshot({ path: 'e2e/screenshots/full-playthrough-09-chirality-after.png' })

    // --- Closing: available once the warm-up is done, regardless of which reveal view
    // is showing (ClosingContinue only gates on stage/revealWarmupActive). ---
    const closingContinueButton = page.getByTestId('closing-continue-button')
    await expect(closingContinueButton).toBeVisible()
    await closingContinueButton.click()

    await expect(page.getByText('CLOSING', { exact: true })).toBeVisible()
    expect((await readStoreState(page)).stage).toBe('closing')

    const closingLine = page.getByTestId('closing-line')
    await expect(closingLine).toBeAttached()
    const opacityAtStart = await closingLine.evaluate((el) => getComputedStyle(el).opacity)
    expect(Number(opacityAtStart)).toBeLessThan(1)
    await expect(closingLine).toHaveCSS('opacity', '1', { timeout: 3000 })
    await page.screenshot({ path: 'e2e/screenshots/full-playthrough-10-closing.png' })

    // --- Restart: back to Stage 1, and every bit of per-playthrough state genuinely
    // reset, not just the visible stage label. ---
    const restartButton = page.getByTestId('restart-button')
    await expect(restartButton).toBeVisible()
    await restartButton.click()

    await expect(page.getByText('LINE', { exact: true })).toBeVisible()
    const stateAfterRestart = await readStoreState(page)
    expect(stateAfterRestart).toMatchObject({
      stage: 'line',
      attempts: 0,
      revealRotationXW: 0,
      revealRotationYW: 0,
      revealSliceW0: 0,
      revealWarmupActive: false,
      growthTransition: null,
    })
    await expect(page.getByTestId('closing-line')).not.toBeAttached()
    await expect(page.getByTestId('restart-button')).not.toBeAttached()
    // Restart re-triggers Stage 1's own animated camera transition back to its dead-on
    // rest framing (same `setLookAt(..., true)` every other real stage change uses,
    // see cameraFraming.ts/Experience.tsx's `CameraRig`) — a short wait here would still
    // catch it mid-swing (confirmed empirically: visibly tilted at 200ms, fully settled
    // by ~1s), so this screenshot waits long enough to show the actual rested state.
    await page.waitForTimeout(1000)
    await page.screenshot({ path: 'e2e/screenshots/full-playthrough-11-restarted.png' })

    expect(errors).toEqual([])
  })
})
