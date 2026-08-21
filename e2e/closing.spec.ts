import { test, expect } from '@playwright/test'

test.describe('Task 22: closing beat + restart', () => {
  test('continuing from reveal advances to closing, fades in the line, and restart returns to Stage 1', async ({
    page,
  }) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))

    await page.goto('/')
    await page.getByTestId('debug-stage-reveal').click()
    await page.waitForTimeout(300)

    const continueButton = page.getByTestId('closing-continue-button')
    await expect(continueButton).toBeVisible()
    await continueButton.click()

    await expect(page.getByText('CLOSING', { exact: true })).toBeVisible()

    const stageAfterContinue = await page.evaluate(
      () =>
        (
          window as unknown as { __dimensionsStore: { getState: () => { stage: string } } }
        ).__dimensionsStore.getState().stage,
    )
    expect(stageAfterContinue).toBe('closing')

    const closingLine = page.getByTestId('closing-line')
    await expect(closingLine).toBeAttached()

    // Fades in rather than appearing instantly: opacity starts at 0 right after the
    // stage change, then reaches 1 once the transition completes.
    const opacityAtStart = await closingLine.evaluate((el) => getComputedStyle(el).opacity)
    expect(Number(opacityAtStart)).toBeLessThan(1)

    await expect(closingLine).toHaveCSS('opacity', '1', { timeout: 3000 })
    await expect(closingLine).toBeVisible()
    await page.screenshot({ path: 'e2e/screenshots/closing-line.png' })

    const restartButton = page.getByTestId('restart-button')
    await expect(restartButton).toBeVisible()
    await restartButton.click()

    await expect(page.getByText('LINE', { exact: true })).toBeVisible()

    const stateAfterRestart = await page.evaluate(() =>
      (
        window as unknown as {
          __dimensionsStore: {
            getState: () => {
              stage: string
              attempts: number
              revealRotationXW: number
              revealSliceW0: number
            }
          }
        }
      ).__dimensionsStore.getState(),
    )
    expect(stateAfterRestart).toMatchObject({
      stage: 'line',
      attempts: 0,
      revealRotationXW: 0,
      revealSliceW0: 0,
    })

    // Restart leaves no trace of the closing beat's own UI behind.
    await expect(page.getByTestId('closing-line')).not.toBeAttached()
    await expect(page.getByTestId('restart-button')).not.toBeAttached()

    expect(errors).toEqual([])
  })

  test('the continue button is not shown while the slicing warm-up is still active', async ({
    page,
  }) => {
    await page.goto('/')
    // advanceStage() (not setStage) is the only path that turns the warm-up on — see
    // state/store.ts's note on `revealWarmupActive`. Walk there for real via the cube
    // stage rather than the debug jump, which bypasses it.
    await page.getByTestId('debug-stage-cube').click()
    await page.evaluate(() =>
      (
        window as unknown as { __dimensionsStore: { getState: () => { advanceStage: () => void } } }
      ).__dimensionsStore.getState().advanceStage(),
    )
    await page.waitForTimeout(300)

    await expect(page.getByTestId('closing-continue-button')).not.toBeAttached()

    await page.getByTestId('slice-warmup-skip').click()
    await expect(page.getByTestId('closing-continue-button')).toBeVisible()
  })
})
