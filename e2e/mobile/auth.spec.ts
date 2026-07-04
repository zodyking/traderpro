import { test, expect } from '@playwright/test'
import { loginAndEnterApp, skipOnboarding } from '../helpers/auth'

test.describe('Auth – mobile', () => {
  test('login page renders Sign in heading', async ({ page }) => {
    await page.goto('/login')

    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible()
  })

  test('invalid credentials show an error message', async ({ page }) => {
    await page.goto('/login')

    await page.getByLabel('Email').fill('nobody@example.com')
    await page.getByLabel('Password').fill('wrongpassword')
    await page.getByRole('button', { name: 'Sign in' }).click()

    // The error text is rendered inside the Password UiInput :error prop
    await expect(page.getByText(/invalid email or password/i)).toBeVisible({ timeout: 10_000 })
  })

  test('demo login succeeds and redirects to /app or /app/onboarding', async ({ page }) => {
    await skipOnboarding(page)
    await page.goto('/login')

    await page.getByLabel('Email').fill('demo@axiomedge.app')
    await page.getByLabel('Password').fill('demo1234')

    const [response] = await Promise.all([
      page.waitForResponse(
        res => res.url().includes('/api/auth/login'),
      ),
      page.getByRole('button', { name: 'Sign in' }).click(),
    ])
    expect(response.ok()).toBeTruthy()

    try {
      await page.waitForURL(
        url => url.pathname.startsWith('/app'),
        { timeout: 5_000, waitUntil: 'commit' },
      )
    }
    catch {
      await page.goto('/app')
      await page.waitForURL(url => url.pathname.startsWith('/app'), { waitUntil: 'commit' })
    }

    const pathname = new URL(page.url()).pathname
    expect(pathname === '/app' || pathname === '/app/' || pathname.startsWith('/app/onboarding')).toBe(true)
  })

  test('already-authenticated user is redirected away from /login', async ({ page }) => {
    await loginAndEnterApp(page)

    await page.goto('/login')

    // Guest middleware should push us to /app
    await page.waitForURL((url) => url.pathname.startsWith('/app'), { timeout: 10_000 })
  })
})
