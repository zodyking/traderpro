import { expect, test } from '@playwright/test'
import { loginAndEnterApp } from '../helpers/auth'

test.describe('Broker performance page tab switching', () => {
  test.beforeEach(async ({ page }) => {
    await loginAndEnterApp(page)
    await page.goto('/app/broker')
    await expect(page.getByRole('heading', { name: 'Broker Performance' })).toBeVisible()
  })

  test('Connect Alpaca button is visible in page header', async ({ page }) => {
    const connectAlpaca = page.getByRole('button', { name: 'Connect Alpaca' })
    await expect(connectAlpaca).toBeVisible()
    // OAuth may be disabled in CI — either an active link or a disabled configure hint
    const oauthHint = page.getByText('OAuth not configured')
    const isEnabled = await connectAlpaca.isEnabled()
    if (!isEnabled) {
      await expect(oauthHint).toBeVisible()
    }
  })

  test('Calendar P&L tab replaces equity content', async ({ page }) => {
    const tabNav = page.getByRole('navigation', { name: 'Performance tabs' })

    // Equity tab is active by default — its unique panel title must be visible
    // (The panel renders even when the store is still loading/empty)
    await expect(
      page.getByRole('heading', { name: 'Cumulative P&L Curve' }),
    ).toBeVisible({ timeout: 8_000 })

    // Switch to Calendar P&L
    await tabNav.getByRole('button', { name: 'Calendar P&L' }).click()

    // Equity panel title must be gone
    await expect(
      page.getByRole('heading', { name: 'Cumulative P&L Curve' }),
    ).not.toBeVisible()

    // Calendar view: empty state or month grid — both are valid outcomes for a
    // demo account that has no imported broker data
    await expect(
      page
        .getByText('No trade data to display')
        .or(page.getByText('Import broker data to see your calendar')),
    ).toBeVisible({ timeout: 8_000 })
  })

  test('Attribution tab shows breakdown panel headings', async ({ page }) => {
    const tabNav = page.getByRole('navigation', { name: 'Performance tabs' })
    await tabNav.getByRole('button', { name: 'Attribution' }).click()

    await expect(page.getByRole('heading', { name: 'By Symbol' })).toBeVisible({ timeout: 12_000 })
    await expect(page.getByRole('heading', { name: 'By Weekday' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'By Setup Tag' })).toBeVisible()
  })
})
