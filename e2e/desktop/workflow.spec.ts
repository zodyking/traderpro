import { expect, test } from '@playwright/test'
import { loginAndEnterApp } from '../helpers/auth'

test.describe('Full app workflow', () => {
  test.beforeEach(async ({ page }) => {
    await loginAndEnterApp(page)
  })

  // ─── Step 1+2: Home ──────────────────────────────────────────────────────────

  test('home loads with metric cards and activity section', async ({ page }) => {
    await page.goto('/app')
    await expect(page.getByRole('heading', { name: 'Command Center' })).toBeVisible()
    // At least one metric card should render in the grid
    await expect(page.getByText('Portfolio P&L')).toBeVisible()
    // Recent Activity panel title
    await expect(page.getByText('Recent Activity')).toBeVisible()
  })

  // ─── Step 3: Chart ───────────────────────────────────────────────────────────

  test('chart page renders with interval controls', async ({ page }) => {
    await page.goto('/app/chart')
    await expect(page.getByRole('heading', { name: 'Chart Workspace' })).toBeVisible()
    // Interval selector buttons are outside ClientOnly so always rendered
    await expect(page.getByRole('button', { name: '1h' })).toBeVisible()
    await expect(page.getByRole('button', { name: '1d' })).toBeVisible()
  })

  // ─── Step 4: Strategy ────────────────────────────────────────────────────────

  test('strategy lab loads with template picker and rule canvas', async ({ page }) => {
    await page.goto('/app/strategy')
    await expect(page.getByRole('heading', { name: 'Strategy Lab' })).toBeVisible()
    // Template picker toggle and save action always visible
    await expect(page.getByRole('button', { name: 'Templates' })).toBeVisible()
    // Save version button confirms the rule canvas is mounted (may wait for store)
    await expect(
      page.getByRole('button', { name: 'Save version' }),
    ).toBeVisible({ timeout: 10_000 })
  })

  // ─── Step 5: Backtest ────────────────────────────────────────────────────────

  test('backtest page loads and shows empty state without a run', async ({ page }) => {
    await page.goto('/app/backtest')
    await expect(page.getByRole('heading', { name: 'Backtest Report' })).toBeVisible()
    // Without a ?run= query param the empty state is shown
    await expect(page.getByText('No backtest selected')).toBeVisible()
    // CTA link navigates back to Strategy Lab
    await expect(page.getByRole('link', { name: 'Open Strategy Lab' })).toBeVisible()
  })

  // ─── Step 6: Journal ─────────────────────────────────────────────────────────

  test('journal list loads with empty state and new-entry action', async ({ page }) => {
    await page.goto('/app/journal')
    await expect(page.getByRole('heading', { name: 'Trade Journal' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'New entry' })).toBeVisible()
    await expect(page.getByText('No journal entries yet')).toBeVisible({ timeout: 10_000 })
  })

  // ─── Step 7: Broker ──────────────────────────────────────────────────────────

  test('broker dashboard loads with Equity, Calendar P&L and Attribution tabs', async ({ page }) => {
    await page.goto('/app/broker')
    await expect(page.getByRole('heading', { name: 'Broker Performance' })).toBeVisible()
    const tabNav = page.getByRole('navigation', { name: 'Performance tabs' })
    await expect(tabNav.getByRole('button', { name: 'Equity' })).toBeVisible()
    await expect(tabNav.getByRole('button', { name: 'Calendar P&L' })).toBeVisible()
    await expect(tabNav.getByRole('button', { name: 'Attribution' })).toBeVisible()
  })

  // ─── Step 8: Settings ────────────────────────────────────────────────────────

  test('settings page loads with sidebar navigation', async ({ page }) => {
    await page.goto('/app/settings')
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible()
    const sideNav = page.getByRole('navigation', { name: 'Settings sections' })
    await expect(sideNav.getByRole('button', { name: 'Broker Data' })).toBeVisible()
    await expect(sideNav.getByRole('button', { name: 'Account' })).toBeVisible()
  })
})
