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

interface CameraState {
  azimuthAngle: number
  polarAngle: number
  distance: number
}

// Experience.tsx's dev-only `window.__cameraControls` hook — reads the camera's actual
// orbit state directly instead of canvas-pixel diffing, which the plane stage's
// always-animating fill material (Task 7's noise shader) makes unreliable: idle drift
// alone produces a nonzero pixel diff, so a screenshot comparison can't tell "orbit did
// nothing" from "orbit did something too subtle to see." See Task 14's identical lesson
// (store.ts's `window.__dimensionsStore`) for the precedent this follows.
async function getCameraState(page: Page): Promise<CameraState> {
  return page.evaluate(() => {
    const controls = (window as unknown as { __cameraControls: CameraState }).__cameraControls
    const { azimuthAngle, polarAngle, distance } = controls
    return { azimuthAngle, polarAngle, distance }
  })
}

// camera-controls' damped `setLookAt` transition has a long, slowly-converging tail —
// a fixed wait before reading "before" state is a guessing game (it settled fine at
// 700ms in one run, still had a barely-perceptible residual drift at 700ms in another).
// Polling until two consecutive reads exactly match is what actually proves the
// transition has finished, rather than picking a duration and hoping.
async function waitForCameraSettled(page: Page): Promise<CameraState> {
  let previous = await getCameraState(page)
  for (let attempt = 0; attempt < 20; attempt++) {
    await page.waitForTimeout(150)
    const current = await getCameraState(page)
    if (
      current.azimuthAngle === previous.azimuthAngle &&
      current.polarAngle === previous.polarAngle &&
      current.distance === previous.distance
    ) {
      return current
    }
    previous = current
  }
  throw new Error('camera never settled')
}

test.describe('orbit interaction', () => {
  test('free horizontal orbit is not clamped, even past a full revolution', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))

    await page.goto('/')
    await expect(page.locator('canvas')).toBeVisible()
    // Orbit only unlocks from Stage 3 (cube) on — see cameraFraming.ts's
    // `orbitEnabled` note. These two tests are about orbit mechanics specifically, so
    // they run on the cube stage rather than the default Stage 1 (line), which no
    // longer orbits at all.
    await page.getByTestId('debug-stage-cube').click()
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
    await page.getByTestId('debug-stage-cube').click()
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

  test('Stage 1 (line): the camera is locked — dragging off the line does nothing', async ({
    page,
  }) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))

    await page.goto('/')
    await expect(page.locator('canvas')).toBeVisible()
    await page.waitForTimeout(300)

    const before = await canvasSnapshot(page)
    // Off-object, same corner-start dragCanvas uses on every other stage — on Stage 1
    // this used to orbit (a line "floating" in 3D space); per the post-Task-15 design
    // pivot, the 1D world has nothing to orbit around, so the canvas should be
    // completely unaffected, not just close.
    await dragCanvas(page, -800, 400)
    const after = await canvasSnapshot(page)
    expect(after).toEqual(before)

    expect(errors).toEqual([])
  })

  test('Stage 2 (plane): the camera is locked — dragging off the plane does nothing', async ({
    page,
  }) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))

    await page.goto('/')
    await page.getByTestId('debug-stage-plane').click()
    // The animated `setLookAt` transition into Stage 2's framing needs to have fully
    // settled before capturing "before" — otherwise a still-converging transition looks
    // like a spurious diff. See `waitForCameraSettled`'s comment for why this polls
    // instead of guessing a fixed duration.
    const before = await waitForCameraSettled(page)

    // Pixel comparison isn't reliable here — the plane's fill material animates on its
    // own even at rest (Task 7's noise shader), so exact camera state is what actually
    // proves the drag was ignored, not just visually subtle.
    await dragCanvas(page, 600, -350)
    const after = await getCameraState(page)
    expect(after).toEqual(before)

    expect(errors).toEqual([])
  })
})
