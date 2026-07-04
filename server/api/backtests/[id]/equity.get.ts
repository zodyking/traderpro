import { getEquityCurve } from '../../../domains/backtest/service'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Backtest run id required' })
  }

  return getEquityCurve(user.id, id)
})
