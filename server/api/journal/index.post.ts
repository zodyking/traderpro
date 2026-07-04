import { journalCreateSchema } from '#shared/schemas/journal'
import { createEntry } from '../../domains/journal/service'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const body = journalCreateSchema.parse(await readBody(event))
  const entry = await createEntry(user.id, body)
  setResponseStatus(event, 201)
  return entry
})
