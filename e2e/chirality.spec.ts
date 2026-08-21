import { test, expect, type Page } from '@playwright/test'
import { CHIRALITY_PARTS } from '../src/math/chirality'
import { rotateXW } from '../src/math/fourd'

interface CanvasPoint {
  x: number
  y: number
}

interface RevealState {
  revealView: 'slice' | 'projection' | 'chirality'
  revealRotationXW: number
  revealRotationYW: number
  revealSliceW0: number
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

// Same store dev-hook `e2e/reveal.spec.ts`/`e2e/instrumentation-panel.spec.ts` already use
// to read exact 4D state directly, rather than inferring it from canvas pixels — the
// chirality parts' own material isn't animated the way RevealStage's shader is, but the
// technique is identical and there's no reason to diverge from it here.
function revealState(page: Page): Promise<RevealState> {
  return page.evaluate(() => {
    const store = (
      window as unknown as {
        __dimensionsStore: { getState: () => RevealState }
      }
    ).__dimensionsStore
    const { revealView, revealRotationXW, revealRotationYW, revealSliceW0 } = store.getState()
    return { revealView, revealRotationXW, revealRotationYW, revealSliceW0 }
  })
}

async function switchToChiralityView(page: Page) {
  const toggle = page.getByTestId('reveal-view-toggle')
  await toggle.click() // slice -> projection
  await toggle.click() // projection -> chirality
  await expect(toggle).toHaveText('Show slice')
}

test.describe('Stage 4 (reveal): chirality / mirror-flip demo', () => {
  test('is reachable via the view toggle, renders, and stays inert with no drag', async ({
    page,
  }) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))

    await page.goto('/')
    await page.getByTestId('debug-stage-reveal').click()
    await page.waitForTimeout(500)

    await switchToChiralityView(page)

    const state = await revealState(page)
    expect(state).toEqual({
      revealView: 'chirality',
      revealRotationXW: 0,
      revealRotationYW: 0,
      revealSliceW0: 0,
    })

    // The panel drops its tesseract-specific rows for this view (there's no tesseract on
    // screen to describe) but keeps the shared rotation/slice rows, plus a note explaining
    // the swap.
    await expect(page.getByTestId('dimension-row-rotation-xw')).toHaveText('xw: 0.0°')
    await expect(page.getByTestId('dimension-chirality-note')).toBeVisible()
    await expect(page.getByTestId('dimension-row-x')).toHaveCount(0)
    await expect(page.getByTestId('dimension-edge-count')).toHaveCount(0)

    await page.screenshot({ path: 'e2e/screenshots/chirality-rest.png' })

    expect(errors).toEqual([])
  })

  test('dragging through a half-turn warps mid-turn and ends legibly mirrored', async ({
    page,
  }) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))

    await page.goto('/')
    await page.getByTestId('debug-stage-reveal').click()
    await page.waitForTimeout(500)
    await switchToChiralityView(page)

    const center = await canvasCenter(page)
    await page.screenshot({ path: 'e2e/screenshots/chirality-before.png' })

    // Calibration drag: measure radians-per-pixel from a modest, known horizontal drag,
    // then compute a corrective drag that lands as close to an exact half-turn (pi
    // radians) as this linear estimate allows — the drag plane's raycast is an affine
    // map for a fixed-depth plane and a static camera (reveal's camera never moves in
    // this test), so a two-step calibrate-then-correct drag is precise here, unlike
    // Task 17's notes on sweeping a genuinely nonlinear pass/fail margin.
    await dragFrom(page, center, 120, 0)
    await page.waitForTimeout(100)
    const afterCalibration = await revealState(page)
    expect(afterCalibration.revealRotationXW).toBeGreaterThan(0)
    await page.screenshot({ path: 'e2e/screenshots/chirality-mid-turn.png' })

    const radiansPerPixel = afterCalibration.revealRotationXW / 120
    const remainingRadians = Math.PI - afterCalibration.revealRotationXW
    await dragFrom(page, center, remainingRadians / radiansPerPixel, 0)
    await page.waitForTimeout(100)

    const afterHalfTurn = await revealState(page)
    expect(afterHalfTurn.revealRotationXW).toBeCloseTo(Math.PI, 1)
    await page.screenshot({ path: 'e2e/screenshots/chirality-after.png' })

    // Confirm the achieved rotation really is (approximately) the exact x-negating
    // mirror `chirality.test.ts` proves for a precise pi — fed through the app's own
    // `rotateXW`, not re-derived, same technique e2e/reveal.spec.ts's regression test
    // uses for the tesseract.
    const anchors = CHIRALITY_PARTS.map((part) => part.anchor)
    const mirrored = rotateXW(anchors, afterHalfTurn.revealRotationXW)
    for (let i = 0; i < anchors.length; i++) {
      expect(mirrored[i][0]).toBeCloseTo(-anchors[i][0], 1)
    }

    expect(errors).toEqual([])
  })
})
