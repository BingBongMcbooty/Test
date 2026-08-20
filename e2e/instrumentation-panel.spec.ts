import { test, expect, type Page } from '@playwright/test'
import {
  PROJECTION_VIEWER_DISTANCE,
  TESSERACT_EDGES,
  TESSERACT_FACES,
  TESSERACT_VERTICES,
  applyRevealRotation,
  sliceTesseract,
} from '../src/math/fourd'
import { TRACKED_VERTEX_INDEX } from '../src/scene/trackedVertex'

interface CanvasPoint {
  x: number
  y: number
}

async function canvasCenter(page: Page): Promise<CanvasPoint> {
  const box = await page.locator('canvas').boundingBox()
  if (!box) throw new Error('canvas has no bounding box')
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
}

// Starts a drag and leaves the pointer down mid-drag (no mouse.up) so the test can read
// the panel's live values while `ArrowDrag.tsx`'s pointer-move handler is still updating
// the store — callers are responsible for releasing afterward.
async function startDrag(page: Page, from: CanvasPoint, dx: number, dy: number) {
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  await page.mouse.move(from.x + dx, from.y + dy, { steps: 20 })
}

const LOCKED = 'Unknown, unreachable'

test.describe('live instrumentation panel (Stages 1-3)', () => {
  test('Stage 1: x and orthogonality update live, y/z/w stay locked', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))

    await page.goto('/')
    await expect(page.locator('canvas')).toBeVisible()
    await page.waitForTimeout(300)

    // Before any drag this stage, x (unlocked but unattempted) shows no row at all.
    await expect(page.getByTestId('dimension-row-x')).toHaveCount(0)
    await expect(page.getByTestId('dimension-row-y')).toHaveText(`y: ${LOCKED}`)
    await expect(page.getByTestId('dimension-row-z')).toHaveText(`z: ${LOCKED}`)
    await expect(page.getByTestId('dimension-row-w')).toHaveText(`w: ${LOCKED}`)

    const center = await canvasCenter(page)
    // Vertical drag: mostly-parallel to the line's own x axis from this camera angle
    // (validation-wiring.spec.ts's LINE_FAIL_DELTA-style horizontal drag would also
    // work — any drag past the dead zone is enough here, this test isn't about
    // pass/fail outcomes).
    await startDrag(page, center, 0, -200)
    await page.waitForTimeout(150)

    await expect(page.getByTestId('dimension-row-x')).toBeVisible()
    const xText = await page.getByTestId('dimension-row-x').innerText()
    expect(xText).toMatch(/^x: -?\d+\.\d{2}$/)

    await expect(page.getByTestId('dimension-row-y')).toHaveText(`y: ${LOCKED}`)
    await expect(page.getByTestId('dimension-row-z')).toHaveText(`z: ${LOCKED}`)
    await expect(page.getByTestId('dimension-row-w')).toHaveText(`w: ${LOCKED}`)

    const orthoText1 = await page.getByTestId('dimension-orthogonality').innerText()
    expect(orthoText1).not.toBe('orthogonality: —')
    // A genuine direction change (not just further along the same line — the ratio is a
    // function of direction, not magnitude, so extending the same straight drag wouldn't
    // move it) actually changes the live reading, confirming this tracks the pointer in
    // real time rather than showing a value computed once at drag-start.
    await page.mouse.move(center.x + 250, center.y - 30, { steps: 10 })
    await page.waitForTimeout(100)
    const orthoText2 = await page.getByTestId('dimension-orthogonality').innerText()
    expect(orthoText1).not.toBe(orthoText2)

    await page.screenshot({ path: 'e2e/screenshots/instrumentation-stage1.png' })
    await page.mouse.up()

    expect(errors).toEqual([])
  })

  test('Stage 2: x and y light up with real values, z/w stay locked', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))

    await page.goto('/')
    await page.getByTestId('debug-stage-plane').click()
    await page.waitForTimeout(300)

    await expect(page.getByTestId('dimension-row-z')).toHaveText(`z: ${LOCKED}`)
    await expect(page.getByTestId('dimension-row-w')).toHaveText(`w: ${LOCKED}`)

    const center = await canvasCenter(page)
    await startDrag(page, center, 150, -100)
    await page.waitForTimeout(150)

    await expect(page.getByTestId('dimension-row-x')).toBeVisible()
    await expect(page.getByTestId('dimension-row-y')).toBeVisible()
    const xText = await page.getByTestId('dimension-row-x').innerText()
    const yText = await page.getByTestId('dimension-row-y').innerText()
    expect(xText).toMatch(/^x: -?\d+\.\d{2}$/)
    expect(yText).toMatch(/^y: -?\d+\.\d{2}$/)

    await expect(page.getByTestId('dimension-row-z')).toHaveText(`z: ${LOCKED}`)
    await expect(page.getByTestId('dimension-row-w')).toHaveText(`w: ${LOCKED}`)
    await expect(page.getByTestId('dimension-shape-counts')).toHaveText('4v · 4e')

    await page.screenshot({ path: 'e2e/screenshots/instrumentation-stage2.png' })
    await page.mouse.up()

    expect(errors).toEqual([])
  })

  test('Stage 3: x/y/z all light up, w stays locked, orthogonality reads structurally zero', async ({
    page,
  }) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))

    await page.goto('/')
    await page.getByTestId('debug-stage-cube').click()
    await page.waitForTimeout(300)

    const center = await canvasCenter(page)
    await startDrag(page, center, 120, 90)
    await page.waitForTimeout(150)

    await expect(page.getByTestId('dimension-row-x')).toBeVisible()
    await expect(page.getByTestId('dimension-row-y')).toBeVisible()
    await expect(page.getByTestId('dimension-row-z')).toBeVisible()
    await expect(page.getByTestId('dimension-row-w')).toHaveText(`w: ${LOCKED}`)

    // The cube's occupiedAxes is all of x/y/z, so the leftover is always the zero
    // vector (see validation.ts's own doc comment) — the live ratio should read
    // exactly 0.00, not a placeholder, confirming this is real live computation and
    // not just parroting a cached "unreachable" state.
    await expect(page.getByTestId('dimension-orthogonality')).toHaveText('orthogonality: 0.00')
    await expect(page.getByTestId('dimension-shape-counts')).toHaveText('8v · 12e')

    await page.screenshot({ path: 'e2e/screenshots/instrumentation-stage3.png' })
    await page.mouse.up()

    expect(errors).toEqual([])
  })
})

interface RevealState {
  revealView: 'slice' | 'projection'
  revealRotationXW: number
  revealRotationYW: number
  revealSliceW0: number
}

// Same store dev-hook `e2e/reveal.spec.ts` already uses to read exact 4D state — see that
// file's comment for why canvas-pixel diffing can't be trusted here (RevealStage's
// material animates on its own regardless of drag input).
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

async function dragFrom(page: Page, from: CanvasPoint, dx: number, dy: number) {
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  await page.mouse.move(from.x + dx, from.y + dy, { steps: 20 })
  await page.mouse.up()
}

test.describe('live instrumentation panel (Stage 4 reveal)', () => {
  test('rotation/slice/tracked-vertex readouts match math/fourd.ts fed the same drag-driven state', async ({
    page,
  }) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))

    await page.goto('/')
    await page.getByTestId('debug-stage-reveal').click()
    await page.waitForTimeout(300)

    const center = await canvasCenter(page)
    await dragFrom(page, center, 150, -80)
    await page.waitForTimeout(100)

    const state = await revealState(page)
    expect(state.revealRotationXW).toBeGreaterThan(0)

    // Independently recompute the tracked vertex's live x/y/z/w by feeding the exact
    // same rotation state through the app's own math/fourd.ts functions — not a
    // re-derivation of the panel's own arithmetic, the same technique
    // e2e/reveal.spec.ts's regression test already uses.
    const rotated = applyRevealRotation(
      TESSERACT_VERTICES,
      state.revealRotationXW,
      state.revealRotationYW,
    )
    const [expectedX, expectedY, expectedZ, expectedW] = rotated[TRACKED_VERTEX_INDEX]

    await expect(page.getByTestId('dimension-row-rotation-xw')).toHaveText(
      `xw: ${((state.revealRotationXW * 180) / Math.PI).toFixed(1)}°`,
    )
    await expect(page.getByTestId('dimension-row-rotation-yw')).toHaveText(
      `yw: ${((state.revealRotationYW * 180) / Math.PI).toFixed(1)}°`,
    )
    await expect(page.getByTestId('dimension-row-slice-w0')).toHaveText(
      `w0: ${state.revealSliceW0.toFixed(2)}`,
    )
    await expect(page.getByTestId('dimension-row-x')).toHaveText(`x: ${expectedX.toFixed(2)}`)
    await expect(page.getByTestId('dimension-row-y')).toHaveText(`y: ${expectedY.toFixed(2)}`)
    await expect(page.getByTestId('dimension-row-z')).toHaveText(`z: ${expectedZ.toFixed(2)}`)
    await expect(page.getByTestId('dimension-row-w')).toHaveText(`w: ${expectedW.toFixed(2)}`)

    const expectedEdgeCount = sliceTesseract(rotated, TESSERACT_FACES, state.revealSliceW0).length
    await expect(page.getByTestId('dimension-edge-count')).toHaveText(`edges: ${expectedEdgeCount}`)

    expect(errors).toEqual([])
  })

  test('slice view shows live extent, "sliced away" for distance-from-projection; projection view is the mirror image', async ({
    page,
  }) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))

    await page.goto('/')
    await page.getByTestId('debug-stage-reveal').click()
    await page.waitForTimeout(300)

    const center = await canvasCenter(page)
    await dragFrom(page, center, 150, -80)
    await page.waitForTimeout(100)

    // Slice view (the default): edge count is live/dynamic, extent shows real numbers,
    // distance-from-projection reads the "wrong lens" placeholder.
    const extentText = await page.getByTestId('dimension-cross-section-extent').innerText()
    expect(extentText).toMatch(/^Δx:-?\d+\.\d{2} Δy:-?\d+\.\d{2} Δz:-?\d+\.\d{2}$/)
    await expect(page.getByTestId('dimension-distance-from-projection')).toHaveText('sliced away')

    await page.screenshot({ path: 'e2e/screenshots/instrumentation-stage4-slice.png' })

    await page.getByTestId('reveal-view-toggle').click()
    await page.waitForTimeout(100)

    // Projection view: edge count is the fixed 32 (a projection never drops anything),
    // extent now reads the "wrong lens" placeholder, and distance-from-projection shows
    // real numbers instead.
    await expect(page.getByTestId('dimension-edge-count')).toHaveText(
      `edges: ${TESSERACT_EDGES.length}`,
    )
    await expect(page.getByTestId('dimension-cross-section-extent')).toHaveText(
      'hidden behind the shadow',
    )
    const distanceText = await page.getByTestId('dimension-distance-from-projection').innerText()
    expect(distanceText).toMatch(/^dist: -?\d+\.\d{2} → ×-?\d+\.\d{2}$/)

    const state = await revealState(page)
    const rotated = applyRevealRotation(
      TESSERACT_VERTICES,
      state.revealRotationXW,
      state.revealRotationYW,
    )
    const trackedW = rotated[TRACKED_VERTEX_INDEX][3]
    const expectedDistance = PROJECTION_VIEWER_DISTANCE - trackedW
    const expectedScale = PROJECTION_VIEWER_DISTANCE / expectedDistance
    expect(distanceText).toBe(`dist: ${expectedDistance.toFixed(2)} → ×${expectedScale.toFixed(2)}`)

    await page.screenshot({ path: 'e2e/screenshots/instrumentation-stage4-projection.png' })

    expect(errors).toEqual([])
  })
})
