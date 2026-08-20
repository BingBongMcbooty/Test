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

// A corner the object's collider never reaches — every stage frames its shape
// comfortably near canvas center (see cameraFraming.ts), so this point is always "off
// the object."
async function canvasCorner(page: Page): Promise<CanvasPoint> {
  const box = await page.locator('canvas').boundingBox()
  if (!box) throw new Error('canvas has no bounding box')
  return { x: box.x + box.width * 0.08, y: box.y + box.height * 0.08 }
}

async function dragFrom(page: Page, from: CanvasPoint, dx: number, dy: number) {
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  await page.mouse.move(from.x + dx, from.y + dy, { steps: 20 })
}

test.describe('pointer/drag controller', () => {
  test('a drag starting on the object draws a live arrow and restores the camera on release', async ({
    page,
  }) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))

    await page.goto('/')
    await expect(page.locator('canvas')).toBeVisible()
    await page.waitForTimeout(300)

    // Line stage's material is fully static (no time-driven shader, unlike plane/cube),
    // so at rest its rendering never changes on its own — any pixel difference below is
    // attributable to the drag interaction, not ambient animation.
    const atRest = await canvasSnapshot(page)
    await page.screenshot({ path: 'e2e/screenshots/arrow-drag-line-at-rest.png' })

    const center = await canvasCenter(page)
    // A roughly-horizontal drag on the line stage (occupiedAxes=['x']) lands well
    // under Task 11's ORTHOGONALITY_THRESHOLD (empirically ~0.65, vs. 0.7 needed) —
    // deterministically a fail, so this test (about drag mechanics, not validation
    // outcomes — see validation-wiring.spec.ts for those) always exercises the fail
    // path rather than sometimes advancing the stage.
    await dragFrom(page, center, 200, 0)

    const midDrag = await canvasSnapshot(page)
    await page.screenshot({ path: 'e2e/screenshots/arrow-drag-line-mid-drag.png' })
    expect(midDrag).not.toEqual(atRest)

    await page.mouse.up()
    // Task 11's fail cue (FAIL_CUE_DURATION = 0.45s) briefly lingers after release —
    // wait for it to fully fade before checking the scene settled back to rest.
    await page.waitForTimeout(700)

    // CameraControls was disabled for the drag and never moved, the fail cue has
    // finished fading, and the live arrow clears on release — the scene should look
    // exactly as it did before the drag.
    const afterRelease = await canvasSnapshot(page)
    expect(afterRelease).toEqual(atRest)

    expect(errors).toEqual([])
  })

  test('a drag starting off the object orbits the camera instead of drawing', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))

    await page.goto('/')
    await expect(page.locator('canvas')).toBeVisible()
    // Orbit only unlocks from Stage 3 (cube) on — see cameraFraming.ts's
    // `orbitEnabled` note. This test is specifically about the off-object-orbits/
    // on-object-draws distinction, which needs a stage where orbit actually exists.
    await page.getByTestId('debug-stage-cube').click()
    await page.waitForTimeout(300)

    const atRest = await canvasSnapshot(page)

    const corner = await canvasCorner(page)
    await dragFrom(page, corner, 300, 100)
    await page.mouse.up()
    await page.waitForTimeout(500)

    const afterRelease = await canvasSnapshot(page)
    await page.screenshot({ path: 'e2e/screenshots/arrow-drag-line-orbit-instead.png' })
    // The camera actually moved (orbit engaged) rather than staying put with an arrow.
    expect(afterRelease).not.toEqual(atRest)

    expect(errors).toEqual([])
  })

  test('cube stage: a mid-drag arrow reads clearly against the shader material from a couple of angles', async ({
    page,
  }) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))

    await page.goto('/')
    await page.getByTestId('debug-stage-cube').click()
    await page.waitForTimeout(300)

    const center = await canvasCenter(page)
    await dragFrom(page, center, 120, 90)
    await page.screenshot({ path: 'e2e/screenshots/arrow-drag-cube-angle-1.png' })
    await page.mouse.up()
    await page.waitForTimeout(300)

    // Orbit to a different angle (drag starts off-object), then draw again from the new
    // angle to confirm legibility isn't a one-angle fluke.
    const corner = await canvasCorner(page)
    await dragFrom(page, corner, -350, 150)
    await page.mouse.up()
    await page.waitForTimeout(500)

    const centerAfterOrbit = await canvasCenter(page)
    await dragFrom(page, centerAfterOrbit, -120, 100)
    await page.screenshot({ path: 'e2e/screenshots/arrow-drag-cube-angle-2.png' })
    await page.mouse.up()
    await page.waitForTimeout(300)

    expect(errors).toEqual([])
  })
})
