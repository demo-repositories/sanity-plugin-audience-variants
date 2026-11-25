import {defineConfig, devices} from '@playwright/test'
import {baseURL, dataset, port, projectId, studioDir} from './e2e/support/env'

/**
 * End-to-end tests: drive the test Studio (../../studio) in a real browser.
 * The Studio loads the plugin from source, so tests always run the current
 * code. It runs on its own port against the `e2e` dataset; see e2e/README.md.
 */
export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/support/global-setup.ts',
  globalTeardown: './e2e/support/global-teardown.ts',
  timeout: 60_000,
  expect: {timeout: 10_000},
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : 4,
  reporter: process.env.CI ? [['list'], ['html', {open: 'never'}]] : [['list']],
  use: {
    baseURL,
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
    screenshot: 'only-on-failure',
    viewport: {width: 1440, height: 1000},
    permissions: ['clipboard-read', 'clipboard-write'],
    // SLOWMO=500 pauses that many ms between actions, to follow along in --headed runs.
    launchOptions: {slowMo: Number(process.env.SLOWMO ?? 0)},
  },
  projects: [
    {name: 'chromium', use: {...devices['Desktop Chrome'], viewport: {width: 1440, height: 1000}}},
  ],
  webServer: {
    command: `npx sanity dev --port ${port}`,
    cwd: studioDir,
    url: baseURL,
    // Reusing is handy while writing tests (`npm run e2e:studio` in another
    // terminal); CI always starts fresh.
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: {
      SANITY_STUDIO_PROJECT_ID: projectId ?? '',
      SANITY_STUDIO_DATASET: dataset,
    },
  },
})
