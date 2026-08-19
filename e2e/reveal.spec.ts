import { test, expect, type Page } from '@playwright/test'

interface CanvasPoint {
  x: number
  y: number
}

interface RevealState {
  revealView: 'slice' | 'projection'
  revealRotation: number
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

// store.ts's dev-only `window.__dimensionsStore` hook — see its comment for why this
// (not canvas-pixel diffing) is what actually proves the underlying 4D state changed:
// RevealStage's material is intentionally always animating (Task 7's visual
// escalation), so pixel-diff magnitude can't cleanly separate "state changed" from
// "the shader's ambient color drifted."
function revealState(page: Page): Promise<RevealState> {
  return page.evaluate(() => {
    const store = (
      window as unknown as {
        __dimensionsStore: { getState: () => RevealState }
      }
    ).__dimensionsStore
    const { revealView, revealRotation, revealSliceW0 } = store.getState()
    return { revealView, revealRotation, revealSliceW0 }
  })
}

test.describe('Stage 4 (reveal): tesseract slicing/projection', () => {
  test('the tesseract only rotates/re-slices in response to a drag, never on a timer', async ({
    page,
  }) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))

    await page.goto('/')
    await page.getByTestId('debug-stage-reveal').click()
    await page.waitForTimeout(500)

    const before = await revealState(page)
    expect(before).toEqual({ revealView: 'slice', revealRotation: 0, revealSliceW0: 0 })

    // No pointer input at all for a beat — the shader keeps animating (visible in the
    // screenshots below), but the 4D state driving the wireframe's shape must not budge.
    await page.screenshot({ path: 'e2e/screenshots/reveal-idle-1.png' })
    await page.waitForTimeout(500)
    await page.screenshot({ path: 'e2e/screenshots/reveal-idle-2.png' })
    const stillIdle = await revealState(page)
    expect(stillIdle).toEqual(before)

    const center = await canvasCenter(page)
    await dragFrom(page, center, 150, -80)
    await page.waitForTimeout(100)

    const afterDrag = await revealState(page)
    // Both the horizontal (rotation) and vertical (slice offset) drag components did
    // something, and in the expected directions for a right+up drag.
    expect(afterDrag.revealRotation).toBeGreaterThan(0)
    expect(afterDrag.revealSliceW0).toBeGreaterThan(0)

    await page.screenshot({ path: 'e2e/screenshots/reveal-slice-after-drag.png' })

    expect(errors).toEqual([])
  })

  test('the view toggle swaps slice/projection without resetting rotation/slice state', async ({
    page,
  }) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))

    await page.goto('/')
    await page.getByTestId('debug-stage-reveal').click()
    await page.waitForTimeout(500)

    const toggle = page.getByTestId('reveal-view-toggle')
    await expect(toggle).toHaveText('Show projection')

    // Move the shared 4D state off its defaults first, so "toggling doesn't reset it"
    // is actually exercised rather than trivially true at (0, 0).
    const center = await canvasCenter(page)
    await dragFrom(page, center, 150, -80)
    await page.waitForTimeout(100)

    const beforeToggle = await revealState(page)
    await page.screenshot({ path: 'e2e/screenshots/reveal-slice-view.png' })

    await toggle.click()
    await expect(toggle).toHaveText('Show slice')
    await page.waitForTimeout(100)

    const afterToggle = await revealState(page)
    expect(afterToggle).toEqual({ ...beforeToggle, revealView: 'projection' })
    await page.screenshot({ path: 'e2e/screenshots/reveal-projection-view.png' })

    await toggle.click()
    await expect(toggle).toHaveText('Show projection')
    const backToSlice = await revealState(page)
    expect(backToSlice).toEqual(beforeToggle)

    expect(errors).toEqual([])
  })
})
