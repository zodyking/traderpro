import { test, expect } from '@playwright/test'

test.describe('smoke', () => {
  test('GET /api/health returns ok', async ({ request }) => {
    const response = await request.get('/api/health')
    expect(response.status()).toBe(200)
    const body = await response.json()
    expect(body).toMatchObject({ status: 'ok' })
  })
})
