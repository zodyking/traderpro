import { test, expect } from '@playwright/test'
import { loginAndEnterApp } from '../helpers/auth'

async function openMoreMenu(page: import('@playwright/test').Page) {
  await page.getByRole('button', { name: 'More navigation' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
}

test.describe('Navigation – mobile', () => {
  test.beforeEach(async ({ page }) => {
    await loginAndEnterApp(page)
  })

  test('mobile tab bar is visible after login', async ({ page }) => {
    const nav = page.getByRole('navigation', { name: 'Mobile navigation' })
    await expect(nav).toBeVisible()
    await expect(page.getByRole('link', { name: 'Home' })).toBeVisible()
  })

  test('navigate to Chart via tab bar', async ({ page }) => {
    await page.getByRole('link', { name: 'Chart' }).click()
    await page.waitForURL('**/app/chart**', { timeout: 10_000 })
    await expect(page.getByRole('heading', { name: 'Chart Workspace' })).toBeVisible()
  })

  test('navigate to Strategy via tab bar', async ({ page }) => {
    await page.getByRole('link', { name: 'Strategy' }).click()
    await page.waitForURL('**/app/strategy**', { timeout: 10_000 })
    expect(new URL(page.url()).pathname).toContain('/app/strategy')
  })

  test('navigate to Journal via tab bar', async ({ page }) => {
    await page.getByRole('link', { name: 'Journal' }).click()
    await page.waitForURL('**/app/journal**', { timeout: 10_000 })
    await expect(page.getByRole('heading', { name: 'Trade Journal' })).toBeVisible()
  })

  test('navigate to Backtest via More menu', async ({ page }) => {
    await openMoreMenu(page)
    await page.getByRole('link', { name: 'Backtest' }).click()
    await page.waitForURL('**/app/backtest**', { timeout: 10_000 })
    expect(new URL(page.url()).pathname).toContain('/app/backtest')
  })

  test('navigate to Broker via More menu', async ({ page }) => {
    await openMoreMenu(page)
    await page.getByRole('link', { name: 'Broker' }).click()
    await page.waitForURL('**/app/broker**', { timeout: 10_000 })
    expect(new URL(page.url()).pathname).toContain('/app/broker')
  })

  test('navigate to Settings via More menu', async ({ page }) => {
    await openMoreMenu(page)
    await page.getByRole('link', { name: 'Settings' }).click()
    await page.waitForURL('**/app/settings**', { timeout: 10_000 })
    expect(new URL(page.url()).pathname).toContain('/app/settings')
  })

  test('no horizontal scroll on body at 375 px', async ({ page }) => {
    const hasHorizontalScroll = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth
    })
    expect(hasHorizontalScroll).toBe(false)
  })
})
