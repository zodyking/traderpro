import { updateWatchlistSchema } from '#shared/schemas/workspace'
import {
  deleteWatchlist,
  updateWatchlist,
} from '../../domains/workspace/service'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Watchlist id required' })
  }

  if (event.method === 'DELETE') {
    await deleteWatchlist(user.id, id)
    return { ok: true }
  }

  const body = updateWatchlistSchema.parse(await readBody(event))
  const watchlist = await updateWatchlist(user.id, id, body)
  return { watchlist }
})
