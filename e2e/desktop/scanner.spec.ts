import { expect, test } from '@playwright/test'
import { loginAndEnterApp } from '../helpers/auth'

test.describe('Alert scanner', () => {
  test.beforeEach(async ({ page }) => {
    await loginAndEnterApp(page)
  })

  test('scanner page loads with run action and history section', async ({ page }) => {
    await page.goto('/app/scanner')
    await expect(page.getByRole('heading', { name: 'Alert Scanner' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Run Scan' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Manage Alerts' })).toBeVisible()
  })
})
