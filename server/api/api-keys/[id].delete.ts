import { apiKeyIdParamSchema } from '#shared/schemas/api-keys'
import { revokeApiKey } from '../../domains/identity/api-keys'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'API key id required' })
  }

  apiKeyIdParamSchema.parse({ id })
  await revokeApiKey(user.id, id)

  return { ok: true }
})
