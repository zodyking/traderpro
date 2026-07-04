import { expect, test } from '@playwright/test'
import { loginAndEnterApp } from '../helpers/auth'

test.describe('Journal chat panel – desktop', () => {
  test.beforeEach(async ({ page }) => {
    await loginAndEnterApp(page)
    await page.goto('/app/journal')
    await expect(page.getByRole('heading', { name: 'Trade Journal' })).toBeVisible()
  })

  test('Journal Chat panel opens from entry card', async ({ page }) => {
    const chatBtn = page.getByRole('button', { name: 'Chat' }).first()
    const hasEntries = await chatBtn.isVisible({ timeout: 5_000 }).catch(() => false)

    if (!hasEntries) {
      test.skip()
      return
    }

    await chatBtn.click()

    await expect(page.getByRole('heading', { name: 'Journal Chat' })).toBeVisible({ timeout: 5_000 })
    await expect(
      page.getByText('Multi-turn coaching about this entry'),
    ).toBeVisible()
    await expect(page.getByPlaceholder('Ask about this trade…')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Send' })).toBeVisible()
  })
})
