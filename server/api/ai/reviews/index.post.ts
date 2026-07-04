import { aiReviewCreateSchema } from '#shared/schemas/ai'
import { requestReview } from '../../../domains/ai/service'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const body = aiReviewCreateSchema.parse(await readBody(event))

  const review = await requestReview(user.id, {
    targetType: body.targetType,
    targetId: body.targetId,
    reviewType: body.reviewType,
  })

  setResponseStatus(event, 201)
  return review
})
