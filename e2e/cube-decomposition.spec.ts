import { test, expect, type Page } from '@playwright/test'

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

// Any on-object drag clearing the dead zone works here — the cube's occupiedAxes is
// all of x/y/z (stageConfig.ts), so `evaluateAttempt` fails structurally regardless of
// direction (see validation.ts's note). This delta just needs to be comfortably past
// `MIN_DRAG_LENGTH` in world units, which any drag this size on-screen clears.
const CUBE_DRAG_DELTA = { dx: 140, dy: 90 }

test.describe('Stage 3 (cube) decomposition feedback', () => {
  test('a cube drag stays on Stage 3 and shows plausible non-zero x/y/z percentages', async ({
    page,
  }) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))

    await page.goto('/')
    await page.getByTestId('debug-stage-cube').click()
    await page.waitForTimeout(300)

    const center = await canvasCenter(page)
    await dragFrom(page, center, CUBE_DRAG_DELTA.dx, CUBE_DRAG_DELTA.dy)

    // Stays on Stage 3 — every cube drag is a structural fail (no artificial lock,
    // but no possible pass either — see validation.ts).
    await expect(page.getByText('CUBE', { exact: true })).toBeVisible()

    const decomposition = page.getByTestId('cube-decomposition')
    await expect(decomposition).toBeVisible()
    const text = await decomposition.innerText()

    const percentages = [...text.matchAll(/(\d+)%/g)].map((match) => Number(match[1]))
    expect(percentages).toHaveLength(3)
    // Plausible: each a valid percentage, and — since the drag has real x/y/z
    // components — not all zero, and roughly summing to 100 (axisContributions are
    // fractions of the drag vector's magnitude, so they sum to ~1 by construction).
    for (const pct of percentages) {
      expect(pct).toBeGreaterThanOrEqual(0)
      expect(pct).toBeLessThanOrEqual(100)
    }
    expect(percentages.some((pct) => pct > 0)).toBe(true)
    const total = percentages.reduce((sum, pct) => sum + pct, 0)
    expect(total).toBeGreaterThan(95)
    expect(total).toBeLessThan(105)

    await expect(page.getByTestId('cube-give-up-button')).toBeVisible()
    await page.screenshot({ path: 'e2e/screenshots/cube-decomposition-feedback.png' })

    expect(errors).toEqual([])
  })

  test('enough failed attempts auto-transitions to Stage 4 (reveal)', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))

    await page.goto('/')
    await page.getByTestId('debug-stage-cube').click()
    await page.waitForTimeout(300)

    const center = await canvasCenter(page)
    // CUBE_ATTEMPTS_BEFORE_REVEAL = 3 (stageConfig.ts) — three attempts should be
    // enough to trigger the auto-transition on their own, no button click needed.
    for (let i = 0; i < 3; i++) {
      await dragFrom(page, center, CUBE_DRAG_DELTA.dx, CUBE_DRAG_DELTA.dy)
      await page.waitForTimeout(150)
    }

    // The auto-advance is delayed by FAIL_CUE_DURATION (0.45s) so the last fail cue
    // finishes fading first, plus the camera's own animated transition.
    await expect(page.getByText('REVEAL', { exact: true })).toBeVisible({ timeout: 2000 })

    expect(errors).toEqual([])
  })

  test('the "I understand" button transitions to Stage 4 (reveal) immediately', async ({
    page,
  }) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))

    await page.goto('/')
    await page.getByTestId('debug-stage-cube').click()
    await page.waitForTimeout(300)

    const center = await canvasCenter(page)
    await dragFrom(page, center, CUBE_DRAG_DELTA.dx, CUBE_DRAG_DELTA.dy)

    const giveUpButton = page.getByTestId('cube-give-up-button')
    await expect(giveUpButton).toBeVisible()
    await giveUpButton.click()

    await expect(page.getByText('REVEAL', { exact: true })).toBeVisible()

    expect(errors).toEqual([])
  })
})
