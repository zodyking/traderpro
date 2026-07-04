import { journalIdParamSchema } from '#shared/schemas/journal'
import { getTradeReviews, requestTradeReview } from '../../../domains/journal/service'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const id = getRouterParam(event, 'id')
  journalIdParamSchema.parse({ id })

  if (event.method === 'POST') {
    const review = await requestTradeReview(user.id, id!)
    setResponseStatus(event, 201)
    return review
  }

  return getTradeReviews(user.id, id!)
})
