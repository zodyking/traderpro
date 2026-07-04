import { expect, test } from '@playwright/test'
import { loginAndEnterApp } from '../helpers/auth'

test.describe('Learning path', () => {
  test.beforeEach(async ({ page }) => {
    await loginAndEnterApp(page)
  })

  test('learning page loads with staged curriculum', async ({ page }) => {
    await page.goto('/app/learning')
    await expect(page.getByRole('heading', { name: 'Learning Path' })).toBeVisible()
    await expect(page.getByText('Foundation')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText('Technical Analysis')).toBeVisible()
  })
})
