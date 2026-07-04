import { journalListQuerySchema } from '#shared/schemas/journal'
import { listEntries } from '../../domains/journal/service'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const query = journalListQuerySchema.parse(getQuery(event))
  return listEntries(user.id, query)
})
