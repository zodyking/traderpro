import { createWatchlistSchema } from '#shared/schemas/workspace'
import { createWatchlist } from '../../domains/workspace/service'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const body = createWatchlistSchema.parse(await readBody(event))
  const watchlist = await createWatchlist(user.id, body)
  setResponseStatus(event, 201)
  return { watchlist }
})
