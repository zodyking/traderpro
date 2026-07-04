import { aiReviewIdParamSchema } from '#shared/schemas/ai'
import { getReview } from '../../../domains/ai/service'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Review id required' })
  }
  aiReviewIdParamSchema.parse({ id })

  return getReview(user.id, id)
})
