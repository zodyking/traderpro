import { z } from 'zod'
import { requireUser } from '../../utils/auth'
import { createCheckoutSession } from '../../domains/billing/stripe'

const checkoutSchema = z.object({
  planId: z.string().min(1).default('starter'),
})

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const body = checkoutSchema.parse(await readBody(event).catch(() => ({})))

  const session = await createCheckoutSession(user.id, body.planId, user.email)

  return session
})
