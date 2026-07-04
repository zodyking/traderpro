import { test, expect } from '@playwright/test'
import { loginAndEnterApp } from '../helpers/auth'

test.describe('Journal – mobile', () => {
  test.beforeEach(async ({ page }) => {
    await loginAndEnterApp(page)
    await page.getByRole('link', { name: 'Journal' }).click()
    await page.waitForURL('**/app/journal**', { timeout: 10_000 })
  })

  test('journal page shows "Trade Journal" heading', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Trade Journal' })).toBeVisible()
  })

  test('"New entry" button is visible on the journal page', async ({ page }) => {
    // The button contains an SVG plus icon followed by "New entry" text
    await expect(page.getByRole('button', { name: /new entry/i })).toBeVisible()
  })

  test('clicking "New entry" opens the create modal', async ({ page }) => {
    await page.getByRole('button', { name: /new entry/i }).click()

    await expect(page.getByRole('heading', { name: 'New journal entry' })).toBeVisible({ timeout: 5_000 })
  })

  test('create modal can be dismissed', async ({ page }) => {
    await page.getByRole('button', { name: /new entry/i }).click()
    await expect(page.getByRole('heading', { name: 'New journal entry' })).toBeVisible()

    // Close via the × button inside the modal header
    await page.getByRole('button').filter({ has: page.locator('svg') }).last().click()

    await expect(page.getByRole('heading', { name: 'New journal entry' })).not.toBeVisible({ timeout: 5_000 })
  })

  test('empty state shows "Add first entry" button when no entries exist', async ({ page }) => {
    // Only visible when the journal is empty; skip gracefully when entries are present
    const emptyBtn = page.getByRole('button', { name: /add first entry/i })
    const entryCard = page.locator('.flex.flex-col.gap-4 > .relative').first()

    const hasEntries = await entryCard.isVisible({ timeout: 5_000 }).catch(() => false)
    if (!hasEntries) {
      await expect(emptyBtn).toBeVisible()
    }
  })
})
