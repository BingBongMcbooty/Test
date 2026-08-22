import { existsSync } from 'node:fs'
import { defineConfig } from '@playwright/test'

// This sandbox's preinstalled Playwright browser cache only has the regular Chromium
// build at this fixed path, not the `chromium_headless_shell` Playwright's default
// project wants (see PROGRESS.md's Task 2 notes) — pin to it when present. A different
// sandbox (e.g. a fresh worktree with no `/opt/pw-browsers`, as hit during Task 23) may
// not have it at all; fall back to `undefined` there so Playwright resolves its own
// normally-installed browser (`npx playwright install chromium`) instead of failing to
// launch entirely.
const PINNED_CHROMIUM = '/opt/pw-browsers/chromium'
const executablePath = existsSync(PINNED_CHROMIUM) ? PINNED_CHROMIUM : undefined

export default defineConfig({
  testDir: './e2e',
  use: {
    baseURL: 'http://localhost:5173',
    launchOptions: {
      executablePath,
    },
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
  },
})
