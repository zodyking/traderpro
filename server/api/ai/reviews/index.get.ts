import { aiReviewListQuerySchema } from '#shared/schemas/ai'
import { listReviews } from '../../../domains/ai/service'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const query = aiReviewListQuerySchema.parse(getQuery(event))

  const reviews = await listReviews(user.id, {
    targetType: query.targetType,
    targetId: query.targetId,
  })

  return { reviews }
})
