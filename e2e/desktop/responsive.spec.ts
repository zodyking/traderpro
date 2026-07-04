import { expect, test } from '@playwright/test'
import { loginAndEnterApp } from '../helpers/auth'

test.describe('Desktop responsive layout at 1440 × 900', () => {
  test.beforeEach(async ({ page }) => {
    await loginAndEnterApp(page)
    await page.goto('/app')
    // Confirm the app layout is mounted before measuring
    await expect(page.getByRole('heading', { name: 'Command Center' })).toBeVisible()
  })

  test('nav rail is visible and main content is not hidden behind it', async ({ page }) => {
    const navRail = page.getByRole('navigation', { name: 'Main navigation' })
    const heading = page.getByRole('heading', { name: 'Command Center' })

    await expect(navRail).toBeVisible()
    await expect(heading).toBeVisible()

    const navBox = await navRail.boundingBox()
    const headingBox = await heading.boundingBox()

    expect(navBox).not.toBeNull()
    expect(headingBox).not.toBeNull()

    // The heading must start to the right of the nav rail's right edge
    // (1 px tolerance for sub-pixel rendering)
    expect(headingBox!.x).toBeGreaterThan(navBox!.x + navBox!.width - 1)

    // Nav rail must be on the left side of the viewport
    expect(navBox!.x).toBeLessThan(100)

    // Nav rail should occupy the full viewport height
    expect(navBox!.height).toBeGreaterThan(400)
  })

  test('nav rail items are accessible and keyboard-navigable', async ({ page }) => {
    const navRail = page.getByRole('navigation', { name: 'Main navigation' })

    // All primary sections should have labelled links in the nav rail
    for (const label of ['Home', 'Chart', 'Strategy', 'Backtest', 'Broker', 'Journal', 'Settings']) {
      await expect(navRail.getByRole('link', { name: label })).toBeVisible()
    }

    // Clicking a nav item routes correctly without reloading the whole page
    await navRail.getByRole('link', { name: 'Chart' }).click()
    await page.waitForURL(/\/app\/chart/)
    await expect(page.getByRole('heading', { name: 'Chart Workspace' })).toBeVisible()

    // The Chart link now carries aria-current="page"
    await expect(
      navRail.getByRole('link', { name: 'Chart' }),
    ).toHaveAttribute('aria-current', 'page')
  })

  test('metric cards grid is fully within the viewport and clear of the nav rail', async ({ page }) => {
    // At 1440 px the grid renders 3 columns (lg:grid-cols-3).
    // Locate the grid container by the text it contains.
    const metricsGrid = page
      .locator('div.grid')
      .filter({ has: page.getByText('Portfolio P&L') })
      .first()

    await expect(metricsGrid).toBeVisible()

    const gridBox = await metricsGrid.boundingBox()
    expect(gridBox).not.toBeNull()

    // Grid must not overflow past the right edge of the 1440 px viewport
    expect(gridBox!.x + gridBox!.width).toBeLessThanOrEqual(1441)

    // Grid must start to the right of the nav rail (> 40 px from left edge)
    expect(gridBox!.x).toBeGreaterThan(40)
  })
})
