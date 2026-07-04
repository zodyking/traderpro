import { randomBytes } from 'node:crypto'
import { buildAuthorizeUrl, isAlpacaOAuthConfigured } from '../../../../domains/broker/alpaca'

export default defineEventHandler(async (event) => {
  if (!isAlpacaOAuthConfigured()) {
    throw createError({
      statusCode: 503,
      statusMessage: 'Alpaca OAuth is not configured',
    })
  }

  const user = await requireUser(event)
  const state = randomBytes(24).toString('hex')

  await setUserSession(event, {
    alpacaOAuthState: state,
    alpacaOAuthUserId: user.id,
  })

  return sendRedirect(event, buildAuthorizeUrl(state))
})
