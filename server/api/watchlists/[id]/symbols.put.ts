import { watchlistSymbolsSchema } from '#shared/schemas/workspace'
import { setWatchlistSymbols } from '../../../domains/workspace/service'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Watchlist id required' })
  }

  const body = watchlistSymbolsSchema.parse(await readBody(event))
  const watchlists = await setWatchlistSymbols(user.id, id, body.symbolIds)
  return { watchlists }
})
