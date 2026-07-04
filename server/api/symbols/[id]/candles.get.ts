import { candleQuerySchema } from '#shared/schemas/symbols'
import { getCandles } from '../../../domains/market-data/service'

export default defineEventHandler(async (event) => {
  await requireUser(event)
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Symbol id required' })
  }

  const query = candleQuerySchema.parse(getQuery(event))
  const to = query.to ?? new Date().toISOString()
  const from = query.from ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  return getCandles({
    symbolId: id,
    interval: query.interval,
    from,
    to,
  })
})
