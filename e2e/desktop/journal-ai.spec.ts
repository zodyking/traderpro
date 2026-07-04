import { expect, test } from '@playwright/test'
import { loginAndEnterApp } from '../helpers/auth'

test.describe('Journal AI coaching – desktop', () => {
  test.beforeEach(async ({ page }) => {
    await loginAndEnterApp(page)
    await page.getByRole('link', { name: 'Journal' }).click()
    await page.waitForURL('**/app/journal**', { timeout: 10_000 })
  })

  test('AI coaching section is visible when review panel opens', async ({ page }) => {
    const reviewBtn = page.getByRole('button', { name: /ai review/i }).first()
    const hasEntries = await reviewBtn.isVisible({ timeout: 5_000 }).catch(() => false)

    if (!hasEntries) {
      test.skip()
      return
    }

    await reviewBtn.click()

    await expect(page.getByRole('heading', { name: 'AI Coaching' })).toBeVisible({ timeout: 5_000 })
    await expect(page.getByRole('radiogroup', { name: 'Coaching mode' })).toBeVisible()
    await expect(page.getByRole('radio', { name: 'Trade Review' })).toBeVisible()
    await expect(page.getByRole('radio', { name: 'Risk Referee' })).toBeVisible()
    await expect(page.getByRole('radio', { name: 'Journal Assistant' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Request review' })).toBeVisible()
  })
})
