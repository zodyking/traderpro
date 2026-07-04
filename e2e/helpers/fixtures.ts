import { test as base, type Page } from '@playwright/test'
import { loginAndEnterApp } from './auth'

type AuthFixtures = {
  /** A page that is already authenticated as the demo user and landed on /app. */
  authenticatedPage: Page
}

export const test = base.extend<AuthFixtures>({
  authenticatedPage: async ({ page }, use) => {
    await loginAndEnterApp(page)
    await use(page)
  },
})

export { expect } from '@playwright/test'
