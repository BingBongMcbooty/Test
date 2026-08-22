import { test, expect, type Page } from '@playwright/test'
import { Camera } from 'three'
import { toCameraRelative } from '../src/math/cameraRelative'
import {
  PROJECTION_VIEWER_DISTANCE,
  TESSERACT_EDGES,
  TESSERACT_FACES,
  TESSERACT_VERTICES,
  applyRevealRotation,
  sliceTesseract,
} from '../src/math/fourd'
import { TRACKED_CUBE_VERTEX_WORLD } from '../src/scene/trackedCubeVertex'
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

// Task 24: the shared locked-axis label — see `ui/DimensionPanel.tsx`'s `LOCKED_PRIMARY`.
const LOCKED = 'Outside this world — no direction here yet'

interface CursorPointState {
  liveCursorPoint: { x: number; y: number; z: number } | null
}

// Same dev-only store hook `revealState` below (and `e2e/reveal.spec.ts`) already use —
// reads `liveCursorPoint` directly so a sampled cursor position can be checked against
// the exact value `CursorMarker.tsx`'s on-scene dot is built from, not just against the
// panel's own rounded display of it.
function cursorPointState(page: Page): Promise<CursorPointState> {
  return page.evaluate(() => {
    const store = (window as unknown as { __dimensionsStore: { getState: () => CursorPointState } })
      .__dimensionsStore
    const { liveCursorPoint } = store.getState()
    return { liveCursorPoint }
  })
}

/** Pulls the first `-?\d+\.\d{2}` number out of a panel row's rendered text. */
function firstNumber(text: string): number {
  const match = text.match(/(-?\d+\.\d{2})/)
  if (!match) throw new Error(`no number found in "${text}"`)
  return Number(match[1])
}

// Task 24: reads the real, live camera's world matrix straight out of the dev-only
// `window.__cameraControls` hook (Task 14's precedent) so Stage 3's tracked-vertex
// test can feed the app's *actual* current camera transform through
// `math/cameraRelative.ts`'s own `toCameraRelative` — the same "call the real
// function fed real drag/orbit-driven state, don't re-derive the math" technique this
// file's Stage 4 tests below already use for the tesseract's tracked vertex.
// `_camera` is a `protected` field in camera-controls' TypeScript types, but that's
// erased at runtime — a plain property read in the browser, same as
// `window.__cameraControls.azimuthAngle` elsewhere in this codebase's e2e suite.
function cameraMatrixElements(page: Page): Promise<number[]> {
  return page.evaluate(() => {
    const controls = (
      window as unknown as {
        __cameraControls: { _camera: { matrixWorld: { elements: number[] } } }
      }
    ).__cameraControls
    return Array.from(controls._camera.matrixWorld.elements)
  })
}

/** A `THREE.Camera` whose `matrixWorld` is pinned to `elements` — see `cameraMatrixElements`. */
function fakeCameraFromMatrixElements(elements: number[]): Camera {
  const camera = new Camera()
  camera.matrixWorld.fromArray(elements)
  // `toCameraRelative` calls this to guarantee a fresh transform in the real app —
  // here it would instead recompute `matrixWorld` from the (identity, no-parent)
  // local `matrix` and stomp the real value just injected above, so it's neutralized.
  camera.updateMatrixWorld = () => {}
  return camera
}

test.describe('live instrumentation panel (Stages 1-3)', () => {
  test('Stage 1: a plain pointer-move (no drag) updates x live; y/z/w stay locked; the marker dot tracks the reported x', async ({
    page,
  }) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))

    await page.goto('/')
    await expect(page.locator('canvas')).toBeVisible()
    await page.waitForTimeout(300)

    // Before any pointer move this stage, x's row still renders (Task 24: the row is
    // never hidden, unlike the pre-Task-24 "no row at all" treatment) but reads its
    // "haven't moved yet" placeholder. y/z/w are structurally locked either way.
    await expect(page.getByTestId('dimension-row-x')).toContainText('—')
    await expect(page.getByTestId('dimension-row-y')).toContainText(LOCKED)
    await expect(page.getByTestId('dimension-row-z')).toContainText(LOCKED)
    await expect(page.getByTestId('dimension-row-w')).toContainText(LOCKED)

    const center = await canvasCenter(page)

    // A plain hover — mouse.move only, no mouse.down anywhere in this test — is the
    // whole point being verified here: the panel updates without a drag or an attempt.
    await page.mouse.move(center.x + 90, center.y, { steps: 10 })
    await page.waitForTimeout(150)

    await expect(page.getByTestId('dimension-row-x')).not.toContainText('—')
    const xText = await page.getByTestId('dimension-row-x').innerText()
    expect(xText).toMatch(/-?\d+\.\d{2}/)
    await expect(page.getByTestId('dimension-row-y')).toContainText(LOCKED)
    await expect(page.getByTestId('dimension-row-z')).toContainText(LOCKED)
    await expect(page.getByTestId('dimension-row-w')).toContainText(LOCKED)

    // `CursorMarker.tsx`'s on-scene dot is positioned directly from
    // `liveCursorPoint.x` — the same value the panel's row displays (rounded to 2
    // decimals) — so confirming they agree at a few different sampled cursor
    // positions is what "the marker dot's position matches the reported x value"
    // (PLAN.md's verify step) actually checks end to end.
    for (const dx of [90, -140, 40]) {
      await page.mouse.move(center.x + dx, center.y + 20, { steps: 10 })
      await page.waitForTimeout(120)
      const state = await cursorPointState(page)
      expect(state.liveCursorPoint).not.toBeNull()
      const panelValue = firstNumber(await page.getByTestId('dimension-row-x').innerText())
      expect(panelValue).toBeCloseTo(state.liveCursorPoint!.x, 1)
    }

    // Confirms the label hierarchy PLAN.md's verify step asks for: the plain-language
    // primary line reads visually larger than the bracketed notation subtext beneath
    // it, not the other way around (Task 15/19's original terse-notation-first panel).
    const primaryFontSize = await page
      .getByTestId('dimension-row-x')
      .locator('div')
      .first()
      .evaluate((el) => Number.parseFloat(getComputedStyle(el).fontSize))
    const notationFontSize = await page
      .getByTestId('dimension-row-x')
      .locator('div')
      .nth(1)
      .evaluate((el) => Number.parseFloat(getComputedStyle(el).fontSize))
    expect(primaryFontSize).toBeGreaterThan(notationFontSize)

    await page.screenshot({ path: 'e2e/screenshots/instrumentation-stage1.png' })

    expect(errors).toEqual([])
  })

  test('Stage 2: a plain pointer-move updates x and y live; z/w stay locked', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))

    await page.goto('/')
    await page.getByTestId('debug-stage-plane').click()
    await page.waitForTimeout(300)

    await expect(page.getByTestId('dimension-row-x')).toContainText('—')
    await expect(page.getByTestId('dimension-row-y')).toContainText('—')
    await expect(page.getByTestId('dimension-row-z')).toContainText(LOCKED)
    await expect(page.getByTestId('dimension-row-w')).toContainText(LOCKED)

    const center = await canvasCenter(page)
    // Plain hover again — no mouse.down.
    await page.mouse.move(center.x + 100, center.y - 60, { steps: 10 })
    await page.waitForTimeout(150)

    const xText = await page.getByTestId('dimension-row-x').innerText()
    const yText = await page.getByTestId('dimension-row-y').innerText()
    expect(xText).toMatch(/-?\d+\.\d{2}/)
    expect(yText).toMatch(/-?\d+\.\d{2}/)

    await expect(page.getByTestId('dimension-row-z')).toContainText(LOCKED)
    await expect(page.getByTestId('dimension-row-w')).toContainText(LOCKED)
    await expect(page.getByTestId('dimension-shape-counts')).toContainText(
      'This shape has 4 corners and 4 edges',
    )

    await page.screenshot({ path: 'e2e/screenshots/instrumentation-stage2.png' })

    expect(errors).toEqual([])
  })

  test('Stage 3: the tracked corner is live with no drag needed, changes as the camera orbits, and matches an independent camera-relative recomputation', async ({
    page,
  }) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))

    await page.goto('/')
    await page.getByTestId('debug-stage-cube').click()
    await page.waitForTimeout(400)

    // Continuous, per PLAN.md's Task 24 ask: real numbers already show up on entering
    // Stage 3, with no drag or button press at all — `TrackedCubeVertexTracker.tsx`
    // writes a value every frame regardless of interaction.
    await expect(page.getByTestId('dimension-row-x')).not.toContainText('—')
    const beforeOrbitText = await page.getByTestId('dimension-row-x').innerText()
    expect(beforeOrbitText).toMatch(/-?\d+\.\d{2}/)
    await expect(page.getByTestId('dimension-row-w')).toContainText(LOCKED)

    // Orbit the camera via the D-pad — a real camera rotation, not a drag/attempt —
    // and confirm the readout changes as a result. This is the whole point of the
    // camera-relative design the user confirmed (see PROGRESS.md): the cube itself
    // never moves, only the camera does, so this is the only way a "live" reading is
    // possible at all here.
    for (let i = 0; i < 5; i++) {
      await page.getByTestId('camera-control-right').click()
      await page.waitForTimeout(60)
    }
    await page.waitForTimeout(500)
    const afterOrbitText = await page.getByTestId('dimension-row-x').innerText()
    expect(afterOrbitText).not.toBe(beforeOrbitText)

    // Independently recompute the expected camera-relative x/y/z by feeding the app's
    // own real, current camera transform through the same `toCameraRelative` function
    // the app itself uses — not a re-derivation, the same "call the real function fed
    // real state" technique this file's Stage 4 tests below already use for the
    // tesseract's tracked vertex.
    const elements = await cameraMatrixElements(page)
    const fakeCamera = fakeCameraFromMatrixElements(elements)
    const expected = toCameraRelative(TRACKED_CUBE_VERTEX_WORLD.clone(), fakeCamera)

    const xVal = firstNumber(await page.getByTestId('dimension-row-x').innerText())
    const yVal = firstNumber(await page.getByTestId('dimension-row-y').innerText())
    const zVal = firstNumber(await page.getByTestId('dimension-row-z').innerText())
    expect(xVal).toBeCloseTo(expected.x, 1)
    expect(yVal).toBeCloseTo(expected.y, 1)
    expect(zVal).toBeCloseTo(expected.z, 1)

    await expect(page.getByTestId('dimension-shape-counts')).toContainText(
      'This shape has 8 corners and 12 edges',
    )

    await page.screenshot({ path: 'e2e/screenshots/instrumentation-stage3.png' })

    expect(errors).toEqual([])
  })

  test('Stage 3: a real drag still updates the (separate) attempt-feedback rows — orthogonality reads structurally zero', async ({
    page,
  }) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))

    await page.goto('/')
    await page.getByTestId('debug-stage-cube').click()
    await page.waitForTimeout(300)

    // Not yet dragged this stage: the attempt-feedback rows (a separate concern from
    // the always-live tracked-vertex rows above) still start at their placeholder.
    await expect(page.getByTestId('dimension-orthogonality')).toContainText('—')

    const center = await canvasCenter(page)
    await startDrag(page, center, 120, 90)
    await page.waitForTimeout(150)

    // The cube's occupiedAxes is all of x/y/z, so the leftover is always the zero
    // vector (see validation.ts's own doc comment) — the live ratio should read
    // exactly 0.00, not a placeholder, confirming this is real live computation and
    // not just parroting a cached "unreachable" state.
    await expect(page.getByTestId('dimension-orthogonality')).toContainText('0.00')

    await page.mouse.up()

    expect(errors).toEqual([])
  })

  test('reveal stage (chirality view): the panel stays capped at its intended width instead of growing to fit its longest row', async ({
    page,
  }) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))

    await page.goto('/')
    await page.getByTestId('debug-stage-reveal').click()
    await page.waitForTimeout(300)
    // slice -> projection -> chirality: the view whose note (a full sentence, no
    // tesseract rows underneath it, so nothing else in the panel was wide enough to
    // force wrapping on its own) is what originally grew the panel wide enough to
    // overlap the centered header — see `ui/DimensionPanel.tsx`'s `panelContainerStyle`
    // fix (a `maxWidth` it previously had none of at all).
    await page.getByTestId('reveal-view-toggle').click()
    await page.getByTestId('reveal-view-toggle').click()
    await page.waitForTimeout(150)

    await expect(page.getByTestId('dimension-chirality-note')).toBeVisible()

    // The regression itself: before the fix, this box's width grew to fit the note's
    // full sentence on one unwrapped line (measured well past 400px in this same
    // viewport) — a bounding-box check on the *panel* against the (always
    // full-viewport-width, `width: 100%`, purely-CSS-centered) header container would
    // pass trivially either way, so this asserts directly on the property that
    // actually changed: the panel's own rendered width is now capped regardless of how
    // long its content gets, which is what forces the note to wrap instead of
    // stretching the box.
    const panelBox = await page.getByTestId('dimension-panel').boundingBox()
    if (!panelBox) throw new Error('panel has no bounding box')
    // 14rem at the default 16px root, plus a small tolerance for scrollbar/subpixel
    // rounding — see `panelContainerStyle`'s `maxWidth`.
    expect(panelBox.width).toBeLessThanOrEqual(230)

    // The note text itself should still be fully present (wrapped across multiple
    // lines, not clipped or truncated away) — confirms the fix is "wrap," not
    // "overflow: hidden."
    await expect(page.getByTestId('dimension-chirality-note')).toContainText(
      'no tesseract readouts here',
    )

    await page.screenshot({ path: 'e2e/screenshots/instrumentation-chirality-no-overlap.png' })

    expect(errors).toEqual([])
  })
})

interface RevealState {
  revealView: 'slice' | 'projection' | 'chirality'
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
