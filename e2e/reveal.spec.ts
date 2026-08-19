import { test, expect, type Page } from '@playwright/test'
import {
  TESSERACT_FACES,
  TESSERACT_VERTICES,
  rotateXW,
  rotateYW,
  sliceTesseract,
} from '../src/math/fourd'

interface CanvasPoint {
  x: number
  y: number
}

interface RevealState {
  revealView: 'slice' | 'projection'
  revealRotationXW: number
  revealRotationYW: number
  revealSliceW0: number
}

async function canvasCenter(page: Page): Promise<CanvasPoint> {
  const box = await page.locator('canvas').boundingBox()
  if (!box) throw new Error('canvas has no bounding box')
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
}

async function dragFrom(
  page: Page,
  from: CanvasPoint,
  dx: number,
  dy: number,
  options?: { shift?: boolean },
) {
  if (options?.shift) await page.keyboard.down('Shift')
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  await page.mouse.move(from.x + dx, from.y + dy, { steps: 20 })
  await page.mouse.up()
  if (options?.shift) await page.keyboard.up('Shift')
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
    const { revealView, revealRotationXW, revealRotationYW, revealSliceW0 } = store.getState()
    return { revealView, revealRotationXW, revealRotationYW, revealSliceW0 }
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
    expect(before).toEqual({
      revealView: 'slice',
      revealRotationXW: 0,
      revealRotationYW: 0,
      revealSliceW0: 0,
    })

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
    // The unmodified drag's horizontal (xw rotation) and vertical (slice offset)
    // components both did something, in the expected directions, and left the
    // Shift-only yw rotation untouched.
    expect(afterDrag.revealRotationXW).toBeGreaterThan(0)
    expect(afterDrag.revealRotationYW).toBe(0)
    expect(afterDrag.revealSliceW0).toBeGreaterThan(0)

    await page.screenshot({ path: 'e2e/screenshots/reveal-slice-after-drag.png' })

    expect(errors).toEqual([])
  })

  test('Shift+drag rotates in the yw plane instead of xw, leaving xw untouched', async ({
    page,
  }) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))

    await page.goto('/')
    await page.getByTestId('debug-stage-reveal').click()
    await page.waitForTimeout(500)

    const center = await canvasCenter(page)
    await dragFrom(page, center, 150, -80, { shift: true })
    await page.waitForTimeout(100)

    const afterShiftDrag = await revealState(page)
    expect(afterShiftDrag.revealRotationXW).toBe(0)
    expect(afterShiftDrag.revealRotationYW).toBeGreaterThan(0)
    expect(afterShiftDrag.revealSliceW0).toBeGreaterThan(0)

    expect(errors).toEqual([])
  })

  test('regression: composing both rotations breaks the "slice is always a box" degeneracy', async ({
    page,
  }) => {
    // xw-rotation alone confines the slicing hyperplane's normal to the x-w plane, so
    // the cross-section's y/z range is always exactly [-1, 1] no matter the rotation or
    // slice offset — a real playtest surfaced this as the shape "wobbling" instead of
    // changing shape. RevealDrag's Shift+drag (yw rotation) is the fix. This test drives
    // both through the real browser interaction, then feeds the resulting state through
    // the same math the app itself uses (not a re-derivation) to confirm the fix holds
    // end to end, not just in fourd.test.ts's isolated unit tests.
    await page.goto('/')
    await page.getByTestId('debug-stage-reveal').click()
    await page.waitForTimeout(500)

    const center = await canvasCenter(page)
    await dragFrom(page, center, 120, 0)
    await dragFrom(page, center, 120, 0, { shift: true })
    await page.waitForTimeout(100)

    const { revealRotationXW, revealRotationYW } = await revealState(page)
    expect(revealRotationXW).toBeGreaterThan(0)
    expect(revealRotationYW).toBeGreaterThan(0)

    const rotated = rotateYW(rotateXW(TESSERACT_VERTICES, revealRotationXW), revealRotationYW)
    const yRangeAt = (w0: number) => {
      const edges = sliceTesseract(rotated, TESSERACT_FACES, w0)
      const ys = edges.flatMap((edge) => [edge.a.y, edge.b.y])
      return ys.length > 0 ? Math.max(...ys) - Math.min(...ys) : 0
    }

    // With yw rotation contributing, the y-range at two different slice offsets should
    // actually differ — the fixed "always exactly 2" degeneracy is gone.
    expect(Math.abs(yRangeAt(0) - yRangeAt(0.6))).toBeGreaterThan(0.1)
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
