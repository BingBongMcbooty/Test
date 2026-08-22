import { test, expect, type Page, type Locator } from '@playwright/test'
import { PLANE_TILT_RANGE } from '../src/scene/cameraFraming'

// three.js renders with `preserveDrawingBuffer: false`, so `canvas.toDataURL()` can
// read back stale/blank pixels regardless of what's actually on screen. A compositor
// screenshot (same mechanism as the working Task 5 test) reflects reality instead.
async function canvasSnapshot(page: Page): Promise<Buffer> {
  return page.locator('canvas').screenshot()
}

interface CanvasPoint {
  x: number
  y: number
}

async function canvasCorner(page: Page): Promise<CanvasPoint> {
  const box = await page.locator('canvas').boundingBox()
  if (!box) throw new Error('canvas has no bounding box')
  // A corner every stage's shape collider never reaches (see cameraFraming.ts) — used to
  // confirm an off-object drag never drives the camera, Task 17's core guarantee.
  return { x: box.x + box.width * 0.08, y: box.y + box.height * 0.08 }
}

async function dragFrom(page: Page, from: CanvasPoint, dx: number, dy: number) {
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  await page.mouse.move(from.x + dx, from.y + dy, { steps: 20 })
  await page.mouse.up()
  await page.waitForTimeout(300)
}

interface CameraState {
  azimuthAngle: number
  polarAngle: number
  distance: number
}

// Experience.tsx's dev-only `window.__cameraControls` hook — reads the camera's actual
// orbit state directly instead of canvas-pixel diffing, which the plane stage's
// always-animating fill material (Task 7's noise shader) and the cube/reveal stages'
// shader materials make unreliable: idle drift alone produces a nonzero pixel diff, so
// a screenshot comparison can't tell "camera did nothing" from "camera did something too
// subtle to see." See Task 14's identical lesson (store.ts's `window.__dimensionsStore`)
// for the precedent this follows.
async function getCameraState(page: Page): Promise<CameraState> {
  return page.evaluate(() => {
    const controls = (window as unknown as { __cameraControls: CameraState }).__cameraControls
    const { azimuthAngle, polarAngle, distance } = controls
    return { azimuthAngle, polarAngle, distance }
  })
}

// camera-controls' damped transitions have a long, slowly-converging tail — a fixed
// wait before reading "before" state is a guessing game. Polling until two consecutive
// reads exactly match is what actually proves a transition has finished.
//
// Task 17 fix (pre-existing flake, documented in PROGRESS.md's Task 16 notes and left
// for a later pass): this can be called immediately after a stage-changing click, before
// `Experience.tsx`'s `CameraRig` mount-time `useEffect` has actually run and populated
// `window.__cameraControls` — a genuine race, not just a slow transition. Poll for the
// hook's existence first, rather than assuming it's already there.
async function waitForCameraControls(page: Page): Promise<void> {
  await expect
    .poll(() => page.evaluate(() => Boolean((window as unknown as { __cameraControls?: unknown }).__cameraControls)))
    .toBe(true)
}

async function waitForCameraSettled(page: Page): Promise<CameraState> {
  await waitForCameraControls(page)
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

// Task 17: on-screen camera buttons replace mouse-drag orbit everywhere it used to
// exist. Each click nudges the camera by `ROTATE_STEP` (see
// `CameraDirectionalControls.tsx`) with its own damped transition — clicking
// repeatedly with a short pause between clicks is the button equivalent of
// `orbit.spec.ts`'s old `dragCanvas` helper.
async function clickRepeatedly(button: Locator, times: number) {
  for (let i = 0; i < times; i++) {
    await button.click()
    await button.page().waitForTimeout(60)
  }
}

test.describe('camera controls (Task 17: on-screen buttons, no mouse-drag orbit anywhere)', () => {
  test('free horizontal rotation is not clamped, even past a full revolution', async ({
    page,
  }) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))

    await page.goto('/')
    await expect(page.locator('canvas')).toBeVisible()
    // Camera buttons only unlock from Stage 3 (cube) on with a full unclamped range —
    // see cameraFraming.ts's `cameraControlsEnabled`/`azimuthRange` notes. These two
    // tests are about rotation mechanics specifically, so they run on the cube stage.
    await page.getByTestId('debug-stage-cube').click()
    await page.waitForTimeout(300)

    const before = await canvasSnapshot(page)
    await page.screenshot({ path: 'e2e/screenshots/orbit-horizontal-before.png' })

    // Enough clicks (0.35 rad each, see ROTATE_STEP) to exceed a full azimuth
    // revolution — if azimuth were clamped, this would visibly stall instead of
    // continuing to spin.
    await clickRepeatedly(page.getByTestId('camera-control-right'), 20)
    await waitForCameraSettled(page)

    const afterFullSpin = await canvasSnapshot(page)
    await page.screenshot({ path: 'e2e/screenshots/orbit-horizontal-after.png' })
    expect(afterFullSpin).not.toEqual(before)

    // Confirm it's still responsive afterwards, not stuck.
    await clickRepeatedly(page.getByTestId('camera-control-right'), 3)
    await waitForCameraSettled(page)
    const afterFollowUp = await canvasSnapshot(page)
    expect(afterFollowUp).not.toEqual(afterFullSpin)

    expect(errors).toEqual([])
  })

  test('rotating "over the top" reaches the pole without erroring or locking up', async ({
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

    // Enough "up" clicks to drive the polar angle to its pole (0 or PI) and hold it
    // there — this is the "over the top" case PLAN.md calls out, checking the camera
    // settles cleanly at the extreme instead of erroring or getting stuck.
    await clickRepeatedly(page.getByTestId('camera-control-up'), 15)
    await waitForCameraSettled(page)

    const atPole = await canvasSnapshot(page)
    await page.screenshot({ path: 'e2e/screenshots/orbit-vertical-after.png' })
    expect(atPole).not.toEqual(before)

    // Rotating horizontally from the pole should still work — nothing locked up.
    await clickRepeatedly(page.getByTestId('camera-control-right'), 3)
    await waitForCameraSettled(page)
    const afterFollowUp = await canvasSnapshot(page)
    expect(afterFollowUp).not.toEqual(atPole)

    expect(errors).toEqual([])
  })

  test('cube stage stays framed after rotating to a few different angles via the buttons', async ({
    page,
  }) => {
    await page.goto('/')
    await page.getByTestId('debug-stage-cube').click()
    await page.waitForTimeout(300)

    await page.screenshot({ path: 'e2e/screenshots/orbit-cube-default.png' })

    await clickRepeatedly(page.getByTestId('camera-control-right'), 4)
    await clickRepeatedly(page.getByTestId('camera-control-up'), 2)
    await waitForCameraSettled(page)
    await page.screenshot({ path: 'e2e/screenshots/orbit-cube-angle-2.png' })

    await clickRepeatedly(page.getByTestId('camera-control-left'), 7)
    await clickRepeatedly(page.getByTestId('camera-control-down'), 3)
    await waitForCameraSettled(page)
    await page.screenshot({ path: 'e2e/screenshots/orbit-cube-angle-3.png' })
  })

  test('Stage 1 (line): camera buttons render, nudge the camera on press, and spring back close to dead-on rest after release', async ({
    page,
  }) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))

    await page.goto('/')
    await expect(page.locator('canvas')).toBeVisible()
    await page.waitForTimeout(300)

    // Task 23: buttons now render on every stage, including Stage 1 — previously the
    // only stage with none at all (a hard lock, indistinguishable to the player from
    // "there's nothing to press").
    await expect(page.getByTestId('camera-controls')).toBeVisible()

    const rest = await waitForCameraSettled(page)
    expect(rest.azimuthAngle).toBeCloseTo(0, 5)
    expect(rest.polarAngle).toBeCloseTo(Math.PI / 2, 5)
    const before = await canvasSnapshot(page)

    // Hold the button down (not a quick click) so a mid-press read/screenshot lands
    // while the camera is genuinely still nudged off rest, before any spring-back has
    // had a chance to run — proves pressing actually does something here now, not
    // just that the button exists.
    const rightButton = page.getByTestId('camera-control-right')
    await rightButton.hover()
    await page.mouse.down()
    await page.waitForTimeout(250)
    const midPress = await getCameraState(page)
    expect(midPress.azimuthAngle).not.toBeCloseTo(rest.azimuthAngle, 3)
    const midPressShot = await canvasSnapshot(page)
    expect(midPressShot).not.toEqual(before)
    await page.mouse.up()

    // Task 23's own verify step: azimuth/polar settle back close to the dead-on rest
    // values within a bounded time after release — a spring-back, not a value stuck
    // wherever the press left it.
    const settled = await waitForCameraSettled(page)
    expect(settled.azimuthAngle).toBeCloseTo(0, 2)
    expect(settled.polarAngle).toBeCloseTo(Math.PI / 2, 2)

    // Mouse-drag still never orbits the camera anywhere, unrelated to the buttons
    // above (Task 17's guarantee, unaffected by Task 23).
    const beforeDrag = await getCameraState(page)
    const corner = await canvasCorner(page)
    await dragFrom(page, corner, -800, 400)
    const afterDrag = await getCameraState(page)
    expect(afterDrag).toEqual(beforeDrag)

    expect(errors).toEqual([])
  })

  test('Stage 2 (plane): camera buttons show resistance-then-settle past the tilt boundary, not a hard clamp; dragging off the plane does nothing', async ({
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
    const dead0n = await waitForCameraSettled(page)
    // Stage 2's resting framing is dead-on (Task 17) — azimuth 0, polar pi/2.
    expect(dead0n.azimuthAngle).toBeCloseTo(0, 5)
    expect(dead0n.polarAngle).toBeCloseTo(Math.PI / 2, 5)

    await expect(page.getByTestId('camera-controls')).toBeVisible()

    // Pixel comparison isn't reliable here — the plane's fill material animates on its
    // own even at rest (Task 7's noise shader), so exact camera state is what actually
    // proves the drag was ignored, not just visually subtle.
    const corner = await canvasCorner(page)
    await dragFrom(page, corner, 600, -350)
    const afterDrag = await getCameraState(page)
    expect(afterDrag).toEqual(dead0n)

    // Task 23: a *sustained* hold (not quick clicks) keeps issuing new resisted
    // targets every repeat tick — a true hard clamp could never read higher than
    // PLANE_TILT_RANGE even mid-press, but resistance can, just increasingly
    // reluctantly the further past it the camera already is (see `resistedStep`).
    const rightButton = page.getByTestId('camera-control-right')
    await rightButton.hover()
    await page.mouse.down()
    await page.waitForTimeout(1500)
    const midHold = await getCameraState(page)
    await page.mouse.up()
    expect(midHold.azimuthAngle).toBeGreaterThan(PLANE_TILT_RANGE)

    // ...but once released it settles back down to the tilt boundary, not staying
    // wherever the hold pushed it past it — the resistance's "give" isn't a new
    // permanent range, it eases back to the same edge a hard clamp would have stopped
    // at outright.
    const settled = await waitForCameraSettled(page)
    expect(settled.azimuthAngle).toBeCloseTo(PLANE_TILT_RANGE, 2)
    expect(settled.azimuthAngle).not.toBeCloseTo(dead0n.azimuthAngle, 2)

    expect(errors).toEqual([])
  })
})
