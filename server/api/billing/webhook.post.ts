import { handleWebhookEvent } from '../../domains/billing/stripe'

export default defineEventHandler(async (event) => {
  const signature = getHeader(event, 'stripe-signature')
  if (!signature) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Missing stripe-signature header',
    })
  }

  const body = await readRawBody(event, false)
  if (!body) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Missing request body',
    })
  }

  return handleWebhookEvent(body, signature)
})
