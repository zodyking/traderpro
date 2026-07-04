import { test, expect } from '@playwright/test'
import { loginAndEnterApp } from '../helpers/auth'

test.describe('Chart – mobile', () => {
  test.beforeEach(async ({ page }) => {
    await loginAndEnterApp(page)
    await page.getByRole('link', { name: 'Chart' }).click()
    await page.waitForURL('**/app/chart**', { timeout: 10_000 })
  })

  test('chart page loads without crash', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Chart Workspace' })).toBeVisible()

    // No unhandled error dialog / crash overlay should be present
    await expect(page.locator('body')).not.toContainText('Application error')
    await expect(page.locator('body')).not.toContainText('An unhandled error occurred')
  })

  test('interval buttons are visible', async ({ page }) => {
    // All interval buttons rendered by the v-for loop in chart/index.vue
    for (const label of ['1m', '5m', '15m', '1h', '4h', '1d', '1w']) {
      await expect(page.getByRole('button', { name: label, exact: true })).toBeVisible()
    }
  })

  test('clicking an interval button marks it as active', async ({ page }) => {
    const btn = page.getByRole('button', { name: '1d', exact: true })
    await btn.click()
    // Active interval button gets the border-accent class via dynamic :class binding
    await expect(btn).toHaveClass(/border-accent/)
  })

  test('indicator controls are visible on chart page', async ({ page }) => {
    await expect(page.getByText('Indicators', { exact: true })).toBeVisible()
  })
})
