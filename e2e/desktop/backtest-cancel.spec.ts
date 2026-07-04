import { expect, test } from '@playwright/test'
import { loginAndEnterApp } from '../helpers/auth'

test.describe('Backtest cancel flow', () => {
  test.beforeEach(async ({ page }) => {
    await loginAndEnterApp(page)
  })

  test('backtest page shows empty state when no run is selected', async ({ page }) => {
    await page.goto('/app/backtest')
    await expect(page.getByRole('heading', { name: 'Backtest Report' })).toBeVisible()
    await expect(page.getByText('No backtest selected')).toBeVisible()
    await expect(page.getByRole('link', { name: 'Open Strategy Lab' })).toBeVisible()
  })

  test('user can leave backtest report via strategy lab link', async ({ page }) => {
    await page.goto('/app/backtest')
    await page.getByRole('link', { name: 'Open Strategy Lab' }).click()
    await expect(page).toHaveURL(/\/app\/strategy/)
    await expect(page.getByRole('heading', { name: 'Strategy Lab' })).toBeVisible()
  })
})
