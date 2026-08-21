import { test, expect, type Page } from '@playwright/test'

interface CanvasPoint {
  x: number
  y: number
}

interface SliceWarmupState {
  tilt: number
  sliceZ0: number
}

interface DimensionsStageState {
  stage: string
  revealWarmupActive: boolean
}

// Same store dev-hook `e2e/reveal.spec.ts`/`instrumentation-panel.spec.ts` already use
// to read exact app state, rather than inferring it from the DOM/canvas.
function dimensionsStageState(page: Page): Promise<DimensionsStageState> {
  return page.evaluate(() => {
    const store = (
      window as unknown as { __dimensionsStore: { getState: () => DimensionsStageState } }
    ).__dimensionsStore
    const { stage, revealWarmupActive } = store.getState()
    return { stage, revealWarmupActive }
  })
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

// `scene/SliceWarmup.tsx`'s dev-only `window.__sliceWarmupState` hook — see its comment
// for why this (not canvas-pixel diffing) is what actually proves the cone's tilt/slice
// changed: the cone's own wireframe reuses `useTesseractLineMaterial`, which is always
// animating its color (Task 7's visual escalation), so a plain screenshot diff can't
// cleanly separate "the cone actually moved" from "the shader's color drifted."
function sliceWarmupState(page: Page): Promise<SliceWarmupState> {
  return page.evaluate(() => {
    const store = (window as unknown as { __sliceWarmupState: SliceWarmupState }).__sliceWarmupState
    return { tilt: store.tilt, sliceZ0: store.sliceZ0 }
  })
}

// Reaches the reveal stage via real gameplay progression (one cube-stage drag, then
// "I understand") rather than `debug-stage-reveal` — `state/store.ts`'s
// `revealWarmupActive` is only set by `advanceStage()` landing on 'reveal', deliberately
// not by `setStage` (the debug-jump primitive every other reveal-stage e2e test uses to
// skip straight to the tesseract) — see its doc comment for why.
async function reachRevealViaRealProgression(page: Page) {
  await page.getByTestId('debug-stage-cube').click()
  await page.waitForTimeout(300)
  const center = await canvasCenter(page)
  await dragFrom(page, center, 140, 90)
  await expect(page.getByTestId('cube-give-up-button')).toBeVisible()
  await page.getByTestId('cube-give-up-button').click()
  await page.waitForTimeout(500)
}

test.describe('Stage 4 warm-up: 3D cone slicing', () => {
  test('advancing into reveal shows the cone warm-up, not the tesseract', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))

    await page.goto('/')
    await reachRevealViaRealProgression(page)

    const state = await dimensionsStageState(page)
    expect(state.stage).toBe('reveal')
    expect(state.revealWarmupActive).toBe(true)

    // The warm-up's own controls are showing; the tesseract's are not.
    await expect(page.getByTestId('slice-warmup-skip')).toBeVisible()
    await expect(page.getByTestId('reveal-view-toggle')).toHaveCount(0)
    await expect(page.getByTestId('dimension-panel')).toHaveCount(0)

    await page.screenshot({ path: 'e2e/screenshots/slice-warmup-initial.png' })
    expect(errors).toEqual([])
  })

  test('debug-stage-reveal still bypasses the warm-up, unlike real progression', async ({
    page,
  }) => {
    // Regression guard for the deliberate setStage/advanceStage asymmetry: every
    // pre-existing reveal.spec.ts test jumps via `debug-stage-reveal` and expects the
    // tesseract UI immediately, so that path must never trigger this warm-up.
    await page.goto('/')
    await page.getByTestId('debug-stage-reveal').click()
    await page.waitForTimeout(300)

    expect((await dimensionsStageState(page)).revealWarmupActive).toBe(false)
    await expect(page.getByTestId('slice-warmup-skip')).toHaveCount(0)
    await expect(page.getByTestId('reveal-view-toggle')).toBeVisible()
  })

  test('dragging tilts the cone and moves the slice, changing the cross-section', async ({
    page,
  }) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))

    await page.goto('/')
    await reachRevealViaRealProgression(page)

    const before = await sliceWarmupState(page)
    expect(before).toEqual({ tilt: 0, sliceZ0: 0 })
    await page.screenshot({ path: 'e2e/screenshots/slice-warmup-before-drag.png' })

    const center = await canvasCenter(page)
    await dragFrom(page, center, 120, -90)
    await page.waitForTimeout(100)

    const afterFirst = await sliceWarmupState(page)
    expect(afterFirst.tilt).toBeGreaterThan(0)
    expect(afterFirst.sliceZ0).toBeGreaterThan(0)
    await page.screenshot({ path: 'e2e/screenshots/slice-warmup-after-drag-1.png' })

    await dragFrom(page, center, -60, 150)
    await page.waitForTimeout(100)

    const afterSecond = await sliceWarmupState(page)
    expect(afterSecond.tilt).not.toBeCloseTo(afterFirst.tilt, 5)
    expect(afterSecond.sliceZ0).not.toBeCloseTo(afterFirst.sliceZ0, 5)
    await page.screenshot({ path: 'e2e/screenshots/slice-warmup-after-drag-2.png' })

    expect(errors).toEqual([])
  })

  test('skipping transitions cleanly into the existing tesseract content', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))

    await page.goto('/')
    await reachRevealViaRealProgression(page)

    // Play with it a little first — skipping mid-interaction should still hand off
    // cleanly, not just when untouched.
    const center = await canvasCenter(page)
    await dragFrom(page, center, 100, -70)
    await page.waitForTimeout(100)

    await page.getByTestId('slice-warmup-skip').click()
    await page.waitForTimeout(500)

    const state = await dimensionsStageState(page)
    expect(state.revealWarmupActive).toBe(false)
    expect(state.stage).toBe('reveal')

    // The tesseract's own UI is back, and the warm-up's is gone.
    await expect(page.getByTestId('slice-warmup-skip')).toHaveCount(0)
    await expect(page.getByTestId('reveal-view-toggle')).toBeVisible()
    await expect(page.getByTestId('dimension-panel')).toBeVisible()

    await page.screenshot({ path: 'e2e/screenshots/slice-warmup-after-skip.png' })
    expect(errors).toEqual([])
  })
})
