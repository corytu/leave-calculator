import { defineConfig, devices } from '@playwright/test'

const PORT = 4173
const BASE_URL = `http://localhost:${PORT}/annual-leave-calculator/`

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  // Only Chromium, per the test plan.
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
  },
  // Build (with a fixed VITE_BUILD_DATE so the footer test can assert an
  // exact value) and serve the production bundle, matching how it's
  // actually deployed (base path included).
  webServer: {
    command: `npm run build && npm run preview -- --port ${PORT} --strictPort`,
    url: BASE_URL,
    env: { VITE_BUILD_DATE: '2025-06-15' },
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
