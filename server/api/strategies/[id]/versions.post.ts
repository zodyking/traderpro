import { createStrategyVersionSchema } from '#shared/schemas/strategy'
import { createStrategyVersion } from '../../../domains/strategy/service'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Strategy id required' })
  }

  const body = createStrategyVersionSchema.parse(await readBody(event))
  const version = await createStrategyVersion(user.id, id, body)
  setResponseStatus(event, 201)
  return { version }
})
