import { journalIdParamSchema } from '#shared/schemas/journal'
import { getConversation } from '../../../domains/journal/chat-service'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const id = getRouterParam(event, 'id')
  journalIdParamSchema.parse({ id })

  return getConversation(user.id, id!)
})
