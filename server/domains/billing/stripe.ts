import { randomUUID } from 'node:crypto'
import Stripe from 'stripe'
import { activateSubscription } from './entitlements'

export type CheckoutSession = {
  sessionId: string
  url: string
}

export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY)
}

function getStripe(): Stripe | null {
  const secretKey = process.env.STRIPE_SECRET_KEY
  if (!secretKey) return null
  return new Stripe(secretKey)
}

function getPriceId(planId: string): string | null {
  switch (planId) {
    case 'starter':
      return process.env.STRIPE_PRICE_STARTER ?? null
    case 'pro':
      return process.env.STRIPE_PRICE_PRO ?? null
    default:
      return null
  }
}

async function createMockCheckoutSession(
  userId: string,
  planId: string,
): Promise<CheckoutSession> {
  const sessionId = `cs_test_${randomUUID().replace(/-/g, '')}`
  const baseUrl = process.env.NUXT_PUBLIC_APP_URL || 'http://localhost:3000'

  return {
    sessionId,
    url: `${baseUrl}/app/settings?checkout=success&session_id=${sessionId}&plan=${planId}&user=${userId}`,
  }
}

export async function createCheckoutSession(
  userId: string,
  planId: string = 'starter',
  email?: string,
): Promise<CheckoutSession> {
  const stripe = getStripe()
  if (!stripe) {
    return createMockCheckoutSession(userId, planId)
  }

  const priceId = getPriceId(planId)
  if (!priceId) {
    throw createError({
      statusCode: 400,
      statusMessage: `No Stripe price configured for plan: ${planId}`,
    })
  }

  const baseUrl = process.env.NUXT_PUBLIC_APP_URL || 'http://localhost:3000'

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer_email: email,
    client_reference_id: userId,
    line_items: [{ price: priceId, quantity: 1 }],
    metadata: { userId, planId },
    success_url: `${baseUrl}/app/settings?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${baseUrl}/app/settings?checkout=cancelled`,
  })

  if (!session.url) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Stripe checkout session missing url',
    })
  }

  return {
    sessionId: session.id,
    url: session.url,
  }
}

export async function handleWebhookEvent(
  payload: string | Buffer,
  signature: string,
): Promise<{ received: boolean }> {
  const stripe = getStripe()
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

  if (!stripe || !webhookSecret) {
    return { received: true }
  }

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(payload, signature, webhookSecret)
  }
  catch {
    throw createError({
      statusCode: 400,
      statusMessage: 'Webhook signature verification failed',
    })
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session
    const userId = session.client_reference_id ?? session.metadata?.userId
    const planId = session.metadata?.planId
    const stripeSubId = typeof session.subscription === 'string'
      ? session.subscription
      : session.subscription?.id

    if (userId && planId && stripeSubId) {
      await activateSubscription(userId, planId, stripeSubId)
    }
  }

  return { received: true }
}
