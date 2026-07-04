import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../server/domains/billing/entitlements', () => ({
  activateSubscription: vi.fn(),
}))

const originalEnv = { ...process.env }

describe('stripe billing', () => {
  beforeEach(() => {
    vi.resetModules()
    process.env = { ...originalEnv }
    delete process.env.STRIPE_SECRET_KEY
    delete process.env.STRIPE_WEBHOOK_SECRET
    delete process.env.STRIPE_PRICE_STARTER
    delete process.env.STRIPE_PRICE_PRO
  })

  afterEach(() => {
    process.env = { ...originalEnv }
    vi.restoreAllMocks()
  })

  describe('isStripeConfigured', () => {
    it('returns false when STRIPE_SECRET_KEY is not set', async () => {
      const { isStripeConfigured } = await import('../server/domains/billing/stripe')
      expect(isStripeConfigured()).toBe(false)
    })

    it('returns true when STRIPE_SECRET_KEY is set', async () => {
      process.env.STRIPE_SECRET_KEY = 'sk_test_example'
      const { isStripeConfigured } = await import('../server/domains/billing/stripe')
      expect(isStripeConfigured()).toBe(true)
    })
  })

  describe('createCheckoutSession mock mode', () => {
    it('returns a mock checkout URL when Stripe is not configured', async () => {
      process.env.NUXT_PUBLIC_APP_URL = 'http://localhost:3000'

      const { createCheckoutSession } = await import('../server/domains/billing/stripe')
      const session = await createCheckoutSession('user-123', 'starter', 'user@example.com')

      expect(session.sessionId).toMatch(/^cs_test_/)
      expect(session.url).toContain('http://localhost:3000/app/settings')
      expect(session.url).toContain('checkout=success')
      expect(session.url).toContain('plan=starter')
      expect(session.url).toContain('user=user-123')
    })

    it('uses the requested plan in the mock checkout URL', async () => {
      const { createCheckoutSession } = await import('../server/domains/billing/stripe')
      const session = await createCheckoutSession('user-456', 'pro')

      expect(session.url).toContain('plan=pro')
    })
  })

  describe('handleWebhookEvent mock mode', () => {
    it('accepts webhook payloads without verification when Stripe is not configured', async () => {
      const { handleWebhookEvent } = await import('../server/domains/billing/stripe')
      const result = await handleWebhookEvent('{"type":"checkout.session.completed"}', 'sig_test')

      expect(result).toEqual({ received: true })
    })
  })
})
