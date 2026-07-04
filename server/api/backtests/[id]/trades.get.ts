import { getQuery } from 'h3'
import { listBacktestTrades } from '../../../domains/backtest/service'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Backtest run id required' })
  }

  const query = getQuery(event)
  const cursor = typeof query.cursor === 'string' ? query.cursor : undefined
  const limit = typeof query.limit === 'string' ? Number.parseInt(query.limit, 10) : 500

  return listBacktestTrades(user.id, id, cursor, Number.isFinite(limit) ? limit : 500)
})
