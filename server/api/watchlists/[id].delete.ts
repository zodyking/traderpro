import { deleteWatchlist } from '../../domains/workspace/service'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Watchlist id required' })
  }

  await deleteWatchlist(user.id, id)
  return { ok: true }
})
