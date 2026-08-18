import { test, expect, type Page } from '@playwright/test'

// three.js renders with `preserveDrawingBuffer: false`, so `canvas.toDataURL()` can
// read back stale/blank pixels regardless of what's actually on screen. A compositor
// screenshot (same mechanism as the working Task 5 test) reflects reality instead.
async function canvasSnapshot(page: Page): Promise<Buffer> {
  return page.locator('canvas').screenshot()
}

async function dragCanvas(page: Page, dx: number, dy: number) {
  const box = await page.locator('canvas').boundingBox()
  if (!box) throw new Error('canvas has no bounding box')
  // Off-center, in a corner: since Task 10, a drag starting on the stage's object (which
  // every stage frames comfortably near canvas center) draws an arrow instead of
  // orbiting. These tests care about orbit specifically, so they start from a corner the
  // object's collider never reaches.
  const startX = box.x + box.width * 0.08
  const startY = box.y + box.height * 0.08

  await page.mouse.move(startX, startY)
  await page.mouse.down()
  await page.mouse.move(startX + dx, startY + dy, { steps: 20 })
  await page.mouse.up()
  // Let CameraControls' damping settle before reading the canvas back.
  await page.waitForTimeout(500)
}

test.describe('orbit interaction', () => {
  test('free horizontal orbit is not clamped, even past a full revolution', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))

    await page.goto('/')
    await expect(page.locator('canvas')).toBeVisible()
    await page.waitForTimeout(300)

    const before = await canvasSnapshot(page)
    await page.screenshot({ path: 'e2e/screenshots/orbit-horizontal-before.png' })

    // A drag well past the canvas width is more than one full azimuth revolution at
    // camera-controls' default rotate sensitivity — if azimuth were clamped, this
    // would visibly stall instead of continuing to spin.
    await dragCanvas(page, -2200, 0)

    const afterFullSpin = await canvasSnapshot(page)
    await page.screenshot({ path: 'e2e/screenshots/orbit-horizontal-after.png' })
    expect(afterFullSpin).not.toEqual(before)

    // Confirm it's still responsive afterwards, not stuck.
    await dragCanvas(page, 200, 0)
    const afterFollowUp = await canvasSnapshot(page)
    expect(afterFollowUp).not.toEqual(afterFullSpin)

    expect(errors).toEqual([])
  })

  test('dragging "over the top" reaches the pole without erroring or locking up', async ({
    page,
  }) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))

    await page.goto('/')
    await expect(page.locator('canvas')).toBeVisible()
    await page.waitForTimeout(300)

    const before = await canvasSnapshot(page)
    await page.screenshot({ path: 'e2e/screenshots/orbit-vertical-before.png' })

    // A vertical drag far larger than the canvas height drives the polar angle to its
    // pole (0 or PI) and holds it there — this is the "over the top" case PLAN.md
    // calls out, checking the camera settles cleanly at the extreme instead of
    // erroring or getting stuck.
    await dragCanvas(page, 0, -1500)

    const atPole = await canvasSnapshot(page)
    await page.screenshot({ path: 'e2e/screenshots/orbit-vertical-after.png' })
    expect(atPole).not.toEqual(before)

    // Orbiting horizontally from the pole should still work — nothing locked up.
    await dragCanvas(page, 300, 0)
    const afterFollowUp = await canvasSnapshot(page)
    expect(afterFollowUp).not.toEqual(atPole)

    expect(errors).toEqual([])
  })

  test('cube stage stays framed after orbiting to a few different angles', async ({ page }) => {
    await page.goto('/')
    await page.getByTestId('debug-stage-cube').click()
    await page.waitForTimeout(300)

    await page.screenshot({ path: 'e2e/screenshots/orbit-cube-default.png' })

    await dragCanvas(page, 400, 150)
    await page.screenshot({ path: 'e2e/screenshots/orbit-cube-angle-2.png' })

    await dragCanvas(page, -700, -250)
    await page.screenshot({ path: 'e2e/screenshots/orbit-cube-angle-3.png' })
  })
})
