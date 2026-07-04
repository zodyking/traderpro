import { createStrategySchema } from '#shared/schemas/strategy'
import { createStrategy } from '../../domains/strategy/service'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const body = createStrategySchema.parse(await readBody(event))
  const strategy = await createStrategy(user.id, body)
  setResponseStatus(event, 201)
  return { strategy }
})
