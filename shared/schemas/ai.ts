import { z } from 'zod'

export const aiReviewTargetTypeSchema = z.enum(['strategy', 'trade', 'risk', 'lesson', 'market'])

export const aiReviewCreateSchema = z.object({
  targetType: aiReviewTargetTypeSchema,
  targetId: z.string().uuid(),
  reviewType: aiReviewTargetTypeSchema.optional(),
})

export const aiReviewIdParamSchema = z.object({
  id: z.string().uuid(),
})

export const aiReviewListQuerySchema = z.object({
  targetType: aiReviewTargetTypeSchema.optional(),
  targetId: z.string().uuid().optional(),
})

export type AIReviewCreateInput = z.infer<typeof aiReviewCreateSchema>
export type AIReviewTargetType = z.infer<typeof aiReviewTargetTypeSchema>
