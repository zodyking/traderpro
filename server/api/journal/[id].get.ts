import { journalIdParamSchema } from '#shared/schemas/journal'
import { getEntry } from '../../domains/journal/service'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const id = getRouterParam(event, 'id')
  journalIdParamSchema.parse({ id })
  return getEntry(user.id, id!)
})
