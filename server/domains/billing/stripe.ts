import { randomUUID } from 'node:crypto'

export type CheckoutSession = {
  sessionId: string
  url: string
}

export async function createCheckoutSession(
  userId: string,
  planId: string = 'starter',
): Promise<CheckoutSession> {
  const sessionId = `cs_test_${randomUUID().replace(/-/g, '')}`
  const baseUrl = process.env.NUXT_PUBLIC_APP_URL || 'http://localhost:3000'

  return {
    sessionId,
    url: `${baseUrl}/app/settings?checkout=success&session_id=${sessionId}&plan=${planId}&user=${userId}`,
  }
}
