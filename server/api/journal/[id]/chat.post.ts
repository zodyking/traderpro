import { journalChatPostSchema, journalIdParamSchema } from '#shared/schemas/journal'
import { addMessage } from '../../../domains/journal/chat-service'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const id = getRouterParam(event, 'id')
  journalIdParamSchema.parse({ id })

  const body = journalChatPostSchema.parse(await readBody(event))
  const result = await addMessage(user.id, id!, body.message)

  return result
})
