import { test, expect } from '@playwright/test'

test('loads the app and renders the canvas', async ({ page }) => {
  await page.goto('/')
  const canvas = page.locator('canvas')
  await expect(canvas).toBeVisible()
  await page.waitForTimeout(300)
  await page.screenshot({ path: 'e2e/screenshots/smoke.png' })
})
