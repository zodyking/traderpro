import { validateStrategySchema } from '#shared/schemas/strategy'
import { getStrategy } from '../../../domains/strategy/service'
import { validateStrategyVersion } from '../../../domains/strategy/validation'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Strategy id required' })
  }

  const strategy = await getStrategy(user.id, id)
  const body = validateStrategySchema.parse(await readBody(event))
  const result = validateStrategyVersion(
    body.rules,
    body.riskModel,
    user.uiMode,
    { strategyTimeframe: strategy.timeframe },
  )

  return { result }
})
