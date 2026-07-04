import { apiKeyCreateSchema } from '#shared/schemas/api-keys'
import { createApiKey } from '../../domains/identity/api-keys'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const body = apiKeyCreateSchema.parse(await readBody(event))
  const created = await createApiKey(user.id, body)

  setResponseStatus(event, 201)
  return created
})
