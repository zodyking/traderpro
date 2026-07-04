import { z } from 'zod'
import { requestReview } from '../../../domains/ai/service'

const bodySchema = z.object({
  targetId: z.string().uuid(),
  reviewType: z.string().optional(),
})

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const body = bodySchema.parse(await readBody(event))

  const review = await requestReview(user.id, {
    targetType: 'trade',
    targetId: body.targetId,
    reviewType: 'trade',
  })

  setResponseStatus(event, 201)
  return review
})
