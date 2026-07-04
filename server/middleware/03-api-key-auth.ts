import { getRequestHeader } from 'h3'
import { authenticateApiKey } from '../domains/identity/api-keys'
import { setApiKeyUser } from '../utils/api-key-context'

const API_KEY_PREFIX = 'ae_'

export default defineEventHandler(async (event) => {
  const authorization = getRequestHeader(event, 'authorization')
  if (!authorization?.startsWith('Bearer ')) {
    return
  }

  const token = authorization.slice('Bearer '.length).trim()
  if (!token.startsWith(API_KEY_PREFIX)) {
    return
  }

  const auth = await authenticateApiKey(token)
  if (!auth) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Invalid API key',
    })
  }

  setApiKeyUser(event, {
    userId: auth.userId,
    apiKeyId: auth.apiKeyId,
  })
})
