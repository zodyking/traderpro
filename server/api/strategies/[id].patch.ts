import { updateStrategySchema } from '#shared/schemas/strategy'
import { updateStrategy } from '../../domains/strategy/service'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Strategy id required' })
  }

  const body = updateStrategySchema.parse(await readBody(event))
  const strategy = await updateStrategy(user.id, id, body)
  return { strategy }
})
