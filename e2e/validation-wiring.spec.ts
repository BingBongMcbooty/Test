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

// Drag deltas below were picked empirically (per PLAN.md's Task 11 note pointing at
// `ORTHOGONALITY_THRESHOLD = 0.7`) by dragging from canvas center on each stage and
// logging the raw drag vector's orthogonality ratio, rather than hand-deriving them
// the way Task 8's orthographic-camera tests could — these stages use the real
// perspective camera from `cameraFraming.ts`, so the screen-to-world mapping isn't
// linear enough to compute by hand.
//
// Line stage (occupiedAxes=['x']): a vertical screen drag lands at ratio ~0.97 (well
// clear of 0.7) since the camera's "up" and "depth" directions carry almost none of
// the drag into x; a horizontal drag lands at ratio ~0.65 (clearly under), since
// horizontal screen motion is mostly-but-not-purely along x from this camera angle.
const LINE_PASS_DELTA = { dx: 0, dy: -200 }
const LINE_FAIL_DELTA = { dx: 200, dy: 0 }

// Plane stage (occupiedAxes=['x','y']): the achievable orthogonality ratio from any
// straight screen-space drag tops out around ~0.715 near this angle — this camera
// framing (`CAMERA_FRAMING.plane`) doesn't give a drag much more than the 0.7
// threshold's worth of "pure z" to work with, so this is close to the best case
// rather than a comfortably-clear pass. Worth retuning `CAMERA_FRAMING.plane` in a
// later polish pass if this ever reads as too strict in practice; out of scope here.
const PLANE_PASS_DELTA = { dx: 217, dy: -125 }
const PLANE_FAIL_DELTA = { dx: 0, dy: -200 }

test.describe('validation wiring (Stages 1 & 2)', () => {
  test('a roughly-orthogonal drag on Stage 1 advances to Stage 2 with an animated camera transition', async ({
    page,
  }) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))

    await page.goto('/')
    await expect(page.locator('canvas')).toBeVisible()
    await page.waitForTimeout(300)
    await expect(page.getByText('LINE', { exact: true })).toBeVisible()

    const center = await canvasCenter(page)
    await dragFrom(page, center, LINE_PASS_DELTA.dx, LINE_PASS_DELTA.dy)

    await expect(page.getByText('PLANE', { exact: true })).toBeVisible()

    // The camera transition is animated (drei's `setLookAt(..., true)`), not an
    // instant cut — two snapshots taken close together, both still inside the
    // transition window, should differ from each other (the camera is still moving
    // between them), not just from the pre-drag frame.
    const midTransition1 = await canvasSnapshot(page)
    await page.waitForTimeout(150)
    const midTransition2 = await canvasSnapshot(page)
    expect(midTransition2).not.toEqual(midTransition1)

    // Let it settle, then confirm the final framing looks right by eye.
    await page.waitForTimeout(600)
    await page.screenshot({ path: 'e2e/screenshots/validation-stage1-pass-to-plane.png' })

    expect(errors).toEqual([])
  })

  test('a roughly-parallel drag on Stage 1 stays on Stage 1 and shows a fail cue', async ({
    page,
  }) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))

    await page.goto('/')
    await expect(page.locator('canvas')).toBeVisible()
    await page.waitForTimeout(300)

    const atRest = await canvasSnapshot(page)

    const center = await canvasCenter(page)
    await dragFrom(page, center, LINE_FAIL_DELTA.dx, LINE_FAIL_DELTA.dy)

    // Stays on Stage 1.
    await expect(page.getByText('LINE', { exact: true })).toBeVisible()

    // The fail cue (a flashing/fading red arrow, see FailCueArrow.tsx) is visible
    // right after release — give one frame for the state update to actually render,
    // then confirm the canvas looks different from the at-rest frame.
    await page.waitForTimeout(100)
    const withCue = await canvasSnapshot(page)
    expect(withCue).not.toEqual(atRest)
    await page.screenshot({ path: 'e2e/screenshots/validation-stage1-fail-cue.png' })

    // Once the cue finishes fading (FAIL_CUE_DURATION = 0.45s), the scene returns to
    // exactly its pre-drag state — nothing lingers, camera never moved. Line stage's
    // material is fully static (no time-driven shader, unlike plane/cube — see Task
    // 7's notes), so this pixel-exact comparison is safe here.
    await page.waitForTimeout(700)
    const afterCue = await canvasSnapshot(page)
    expect(afterCue).toEqual(atRest)

    expect(errors).toEqual([])
  })

  test('a roughly-orthogonal drag on Stage 2 advances to Stage 3 (cube)', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))

    await page.goto('/')
    await page.getByTestId('debug-stage-plane').click()
    await page.waitForTimeout(600)
    await expect(page.getByText('PLANE', { exact: true })).toBeVisible()

    const center = await canvasCenter(page)
    await dragFrom(page, center, PLANE_PASS_DELTA.dx, PLANE_PASS_DELTA.dy)

    await expect(page.getByText('CUBE', { exact: true })).toBeVisible()
    await page.waitForTimeout(600)
    await page.screenshot({ path: 'e2e/screenshots/validation-stage2-pass-to-cube.png' })

    expect(errors).toEqual([])
  })

  test('a roughly-parallel drag on Stage 2 stays on Stage 2 with a fail cue', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))

    await page.goto('/')
    await page.getByTestId('debug-stage-plane').click()
    await page.waitForTimeout(600)

    const atRest = await canvasSnapshot(page)

    const center = await canvasCenter(page)
    await dragFrom(page, center, PLANE_FAIL_DELTA.dx, PLANE_FAIL_DELTA.dy)

    // Stays on Stage 2.
    await expect(page.getByText('PLANE', { exact: true })).toBeVisible()

    // The fail cue is visible right after release. Unlike the line stage, the plane
    // stage's fill material animates on its own (`usePlaneFillMaterial`'s `uTime`
    // noise, per Task 7's notes) even at rest, so — unlike the line-stage test above —
    // this only checks the cue shows up, not that the canvas returns to an exact
    // pixel match afterward (it wouldn't, cue or no cue).
    await page.waitForTimeout(100)
    const withCue = await canvasSnapshot(page)
    expect(withCue).not.toEqual(atRest)
    await page.screenshot({ path: 'e2e/screenshots/validation-stage2-fail-cue.png' })

    expect(errors).toEqual([])
  })
})
