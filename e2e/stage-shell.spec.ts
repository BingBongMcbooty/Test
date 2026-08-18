import { test, expect } from '@playwright/test'

const STAGES = ['line', 'plane', 'cube', 'reveal', 'closing'] as const

test('stage router swaps geometry and reframes the camera per stage', async ({ page }) => {
  await page.goto('/')
  const canvas = page.locator('canvas')
  await expect(canvas).toBeVisible()

  // Starts on Stage 1 (line) with no interaction needed.
  await page.waitForTimeout(300)
  await expect(page.getByText('LINE', { exact: true })).toBeVisible()
  await page.screenshot({ path: 'e2e/screenshots/stage-line.png' })

  for (const stage of STAGES.slice(1)) {
    await page.getByTestId(`debug-stage-${stage}`).click()
    await expect(page.getByText(stage.toUpperCase(), { exact: true })).toBeVisible()
    // Let CameraControls' setLookAt settle before the screenshot.
    await page.waitForTimeout(300)
    await page.screenshot({ path: `e2e/screenshots/stage-${stage}.png` })
  }
})
