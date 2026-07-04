import { z } from 'zod'

export const aiReviewTargetTypeSchema = z.enum(['strategy', 'trade', 'risk', 'lesson', 'market'])

export const aiReviewTypeSchema = z.enum(['strategy', 'trade', 'risk', 'lesson', 'market', 'assistant'])

export const aiReviewCreateSchema = z.object({
  targetType: aiReviewTargetTypeSchema,
  targetId: z.string().min(1).max(128),
  reviewType: aiReviewTypeSchema.optional(),
})

export const aiReviewIdParamSchema = z.object({
  id: z.string().uuid(),
})

export const aiReviewListQuerySchema = z.object({
  targetType: aiReviewTargetTypeSchema.optional(),
  targetId: z.string().min(1).max(128).optional(),
})

export type AIReviewCreateInput = z.infer<typeof aiReviewCreateSchema>
export type AIReviewType = z.infer<typeof aiReviewTypeSchema>
export type AIReviewTargetType = z.infer<typeof aiReviewTargetTypeSchema>
