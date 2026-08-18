import { test, expect } from '@playwright/test'

// Task 7's escalation goal: Stage 1 unchanged, Stage 2 visibly "in between," Stage 3
// visibly richer than Task 5's flat version. Screenshots here are reviewed by hand
// (tone is subjective) — this test's job is to catch console/shader-compile errors and
// a frame-rate regression, not to judge the look itself.
test('material/lighting escalation renders without errors across stages', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text())
  })

  await page.goto('/')
  const canvas = page.locator('canvas')
  await expect(canvas).toBeVisible()
  await page.waitForTimeout(300)
  await page.screenshot({ path: 'e2e/screenshots/richness-line.png' })

  await page.getByTestId('debug-stage-plane').click()
  await page.waitForTimeout(300)
  await page.screenshot({ path: 'e2e/screenshots/richness-plane.png' })

  await page.getByTestId('debug-stage-cube').click()
  // Let a few animated frames land before screenshotting, so the shader's time-driven
  // noise/fresnel detail is actually visible rather than caught at t=0.
  await page.waitForTimeout(600)
  const cubeFirst = await canvas.screenshot()
  await page.screenshot({ path: 'e2e/screenshots/richness-cube.png' })

  // A second cube screenshot a bit later, to confirm the material is actually animating
  // (uTime advancing) rather than static.
  await page.waitForTimeout(600)
  const cubeLater = await canvas.screenshot()
  await page.screenshot({ path: 'e2e/screenshots/richness-cube-later.png' })
  expect(cubeLater).not.toEqual(cubeFirst)

  expect(errors).toEqual([])
})

test('cube stage sustains a reasonable frame rate with the shader material', async ({ page }) => {
  await page.goto('/')
  await page.getByTestId('debug-stage-cube').click()
  await page.waitForTimeout(300)

  const fps = await page.evaluate(async () => {
    let frames = 0
    const durationMs = 1000
    const start = performance.now()
    await new Promise<void>((resolve) => {
      function tick() {
        frames += 1
        if (performance.now() - start < durationMs) {
          requestAnimationFrame(tick)
        } else {
          resolve()
        }
      }
      requestAnimationFrame(tick)
    })
    return (frames * 1000) / (performance.now() - start)
  })

  // A generous floor — this is a sanity check against a shader that's pathologically
  // expensive, not a strict perf budget. This sandbox's software-rendered headless
  // Chromium runs noticeably slower and noisier than a real GPU (the line stage's
  // unlit wireframe alone measured ~55-60fps here, the cube's shader material
  // ~25-30fps), so the floor is set well below either to absorb that noise rather than
  // chase a number that's really about this environment, not the shader.
  expect(fps).toBeGreaterThan(15)
})
