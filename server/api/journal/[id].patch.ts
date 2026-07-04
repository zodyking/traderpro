import { journalIdParamSchema, journalUpdateSchema } from '#shared/schemas/journal'
import { updateEntry } from '../../domains/journal/service'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const id = getRouterParam(event, 'id')
  journalIdParamSchema.parse({ id })
  const body = journalUpdateSchema.parse(await readBody(event))
  return updateEntry(user.id, id!, body)
})
