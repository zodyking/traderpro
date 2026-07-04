import { expect, type Page } from '@playwright/test'

const DEMO_EMAIL = 'demo@axiomedge.app'
const DEMO_PASSWORD = 'demo1234'

export async function skipOnboarding(page: Page): Promise<void> {
  await page.addInitScript(() => {
    localStorage.setItem('ae_onboarded', '1')
  })
}

export async function loginAsDemo(page: Page): Promise<void> {
  await skipOnboarding(page)

  const response = await page.request.post('/api/auth/login', {
    data: {
      email: DEMO_EMAIL,
      password: DEMO_PASSWORD,
    },
  })
  expect(response.ok()).toBeTruthy()
}

export async function loginAndEnterApp(page: Page): Promise<void> {
  await loginAsDemo(page)
  await page.goto('/app')
  await page.waitForURL(/\/app(?!\/onboarding)/, { timeout: 15_000 })
}
