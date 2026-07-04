import { defineConfig } from '@playwright/test'

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? process.env.BASE_URL ?? 'http://127.0.0.1:3000'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  timeout: 30_000,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'desktop',
      testMatch: /desktop\/.*\.spec\.ts/,
      use: {
        browserName: 'chromium',
        viewport: { width: 1440, height: 900 },
      },
    },
    {
      name: 'mobile',
      testMatch: /mobile\/.*\.spec\.ts/,
      use: {
        browserName: 'chromium',
        viewport: { width: 375, height: 812 },
        isMobile: true,
        hasTouch: true,
      },
    },
    {
      name: 'smoke',
      testMatch: /smoke\.spec\.ts/,
    },
  ],
  webServer: process.env.PLAYWRIGHT_SKIP_WEBSERVER
    ? undefined
    : {
        command: 'node .output/server/index.mjs',
        url: `${baseURL}/api/health`,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        env: {
          ...process.env,
          HOST: '127.0.0.1',
          PORT: baseURL.includes(':3000') ? '3000' : (new URL(baseURL).port || '3000'),
          NUXT_SESSION_PASSWORD: process.env.NUXT_SESSION_PASSWORD ?? 'test-session-password-at-least-32-chars',
          DATABASE_URL: process.env.DATABASE_URL ?? 'postgresql://axiomedge:axiomedge@127.0.0.1:5432/axiomedge',
          REDIS_URL: process.env.REDIS_URL ?? 'redis://127.0.0.1:6379',
          MARKET_DATA_PROVIDER: process.env.MARKET_DATA_PROVIDER ?? 'mock',
        },
      },
})
