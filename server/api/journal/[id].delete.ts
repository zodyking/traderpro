import { journalIdParamSchema } from '#shared/schemas/journal'
import { deleteEntry } from '../../domains/journal/service'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const id = getRouterParam(event, 'id')
  journalIdParamSchema.parse({ id })
  await deleteEntry(user.id, id!)
  setResponseStatus(event, 204)
  return null
})
