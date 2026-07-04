import { enqueueBrokerSync } from '../../../../domains/broker/sync-service'
import {
  exchangeCode,
  fetchAccount,
  upsertAlpacaConnection,
} from '../../../../domains/broker/alpaca'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const code = typeof query.code === 'string' ? query.code : null
  const state = typeof query.state === 'string' ? query.state : null
  const oauthError = typeof query.error === 'string' ? query.error : null

  const appUrl = process.env.NUXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const settingsUrl = `${appUrl}/app/settings?broker=alpaca`

  if (oauthError) {
    return sendRedirect(event, `${settingsUrl}&alpaca_error=${encodeURIComponent(oauthError)}`)
  }

  if (!code || !state) {
    throw createError({ statusCode: 400, statusMessage: 'Missing OAuth code or state' })
  }

  const session = await getUserSession(event)
  if (!session.alpacaOAuthState || session.alpacaOAuthState !== state) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid OAuth state' })
  }

  const userId = session.alpacaOAuthUserId ?? session.user?.id
  if (!userId) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  await setUserSession(event, {
    alpacaOAuthState: undefined,
    alpacaOAuthUserId: undefined,
  })

  const tokens = await exchangeCode(code)
  const account = await fetchAccount(tokens.accessToken)
  const { connectionId } = await upsertAlpacaConnection(userId, tokens, account)
  await enqueueBrokerSync(userId, connectionId)

  return sendRedirect(event, `${settingsUrl}&alpaca_connected=1`)
})
