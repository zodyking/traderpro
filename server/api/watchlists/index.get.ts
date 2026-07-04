import { listWatchlists } from '../../domains/workspace/service'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const watchlists = await listWatchlists(user.id)
  return { watchlists }
})
