import { expect, test } from '@playwright/test'
import { loginAndEnterApp } from '../helpers/auth'

test.describe('Command palette', () => {
  test.beforeEach(async ({ page }) => {
    await loginAndEnterApp(page)
    await page.goto('/app')
    // Ensure the app layout (and its keyboard shortcuts) are fully mounted
    await expect(page.getByRole('navigation', { name: 'Main navigation' })).toBeVisible()
  })

  test('Cmd+K opens command palette overlay and Escape closes it', async ({ page }) => {
    // Both Meta+K (macOS) and Control+K (Linux/Windows) fire the handler
    await page.keyboard.press('Control+k')

    const dialog = page.getByRole('dialog', { name: 'Command palette' })
    await expect(dialog).toBeVisible()

    // Search input should be focused and ready
    await expect(
      dialog.getByPlaceholder('Search pages, symbols, actions…'),
    ).toBeVisible()

    // Dismiss with Escape
    await page.keyboard.press('Escape')
    await expect(dialog).not.toBeVisible()
  })

  test('can search for Journal and navigate to the Journal page', async ({ page }) => {
    await page.keyboard.press('Control+k')

    const dialog = page.getByRole('dialog', { name: 'Command palette' })
    await expect(dialog).toBeVisible()

    // Type into the palette search input
    await dialog.getByPlaceholder('Search pages, symbols, actions…').fill('Journal')

    // The "Journal" nav result should appear (description differentiates it from actions)
    const journalNavResult = dialog
      .locator('button')
      .filter({ hasText: 'Trade journal and AI review' })
    await expect(journalNavResult).toBeVisible()

    // Clicking the result navigates to /app/journal
    await journalNavResult.click()
    await page.waitForURL(/\/app\/journal/)
    await expect(page.getByRole('heading', { name: 'Trade Journal' })).toBeVisible()
  })
})
