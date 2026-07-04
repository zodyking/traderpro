import { expect, test } from '@playwright/test'
import { loginAndEnterApp } from '../helpers/auth'

test.describe('Settings MFA panel', () => {
  test.beforeEach(async ({ page }) => {
    await loginAndEnterApp(page)
    await page.goto('/app/settings')
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible()
  })

  test('Security panel shows MFA controls on Account tab', async ({ page }) => {
    const sideNav = page.getByRole('navigation', { name: 'Settings sections' })
    await sideNav.getByRole('button', { name: 'Account' }).click()

    await expect(page.getByRole('heading', { name: 'Security' })).toBeVisible()
    await expect(
      page.getByText('Protect your account with a time-based one-time password'),
    ).toBeVisible()

    const enableMfa = page.getByRole('button', { name: 'Enable MFA' })
    const disableMfa = page.getByRole('button', { name: 'Disable MFA' })
    await expect(enableMfa.or(disableMfa)).toBeVisible({ timeout: 8_000 })
  })
})
