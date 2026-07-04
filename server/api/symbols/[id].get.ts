import { getSymbolById } from '../../domains/market-data/service'

export default defineEventHandler(async (event) => {
  await requireUser(event)
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Symbol id required' })
  }

  const symbol = await getSymbolById(id)
  if (!symbol) {
    throw createError({ statusCode: 404, statusMessage: 'Symbol not found' })
  }

  return { symbol }
})
