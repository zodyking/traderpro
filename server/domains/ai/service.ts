import { and, desc, eq } from 'drizzle-orm'
import { v7 as uuidv7 } from 'uuid'
import { aiReviews } from '../../../db/schema'
import type { AIReviewTargetType } from '../../../shared/schemas/ai'
import { checkAiCredits, incrementUsage } from '../billing/entitlements'
import { useDb } from '../../utils/db'
import { getAIProvider } from './factory'
import { buildAIReviewPacket } from './packet'
import { buildPrompt, getSystemPrompt, parseAIResult } from './prompt'

export async function requestReview(
  userId: string,
  input: { targetType: AIReviewTargetType; targetId: string; reviewType?: AIReviewTargetType },
) {
  const usage = await checkAiCredits(userId)
  if (!usage.allowed) {
    throw createError({
      statusCode: 429,
      statusMessage: `AI credit limit reached (${usage.used}/${usage.limit} this month)`,
    })
  }

  const db = useDb()
  const provider = getAIProvider()
  const reviewId = uuidv7()

  const packet = await buildAIReviewPacket(userId, {
    targetType: input.targetType,
    targetId: input.targetId,
    reviewType: input.reviewType,
  })

  await db.insert(aiReviews).values({
    id: reviewId,
    userId,
    targetType: input.targetType,
    targetId: input.targetId,
    packet,
    result: null,
    model: provider.modelName,
    status: 'running',
  })

  try {
    const prompt = buildPrompt(packet)
    const completion = await provider.completeReview(prompt, {
      systemPrompt: getSystemPrompt(packet.requestedReviewType),
      maxTokens: 1024,
      temperature: 0.3,
    })

    const result = parseAIResult(completion.text)

    await db
      .update(aiReviews)
      .set({
        result,
        status: 'done',
        model: completion.model,
        tokensIn: completion.tokensIn,
        tokensOut: completion.tokensOut,
        costUsd: completion.costUsd.toFixed(6),
      })
      .where(eq(aiReviews.id, reviewId))

    await incrementUsage(userId, 'aiCredits')

    return { id: reviewId, status: 'done' as const, result }
  }
  catch (error) {
    await db
      .update(aiReviews)
      .set({ status: 'failed' })
      .where(eq(aiReviews.id, reviewId))
    throw error
  }
}

export async function getReview(userId: string, reviewId: string) {
  const db = useDb()
  const [review] = await db
    .select()
    .from(aiReviews)
    .where(and(eq(aiReviews.id, reviewId), eq(aiReviews.userId, userId)))
    .limit(1)

  if (!review) {
    throw createError({ statusCode: 404, statusMessage: 'AI review not found' })
  }

  return formatReview(review)
}

export async function listReviews(
  userId: string,
  filters: { targetType?: AIReviewTargetType; targetId?: string },
) {
  const db = useDb()
  const conditions = [eq(aiReviews.userId, userId)]

  if (filters.targetType) {
    conditions.push(eq(aiReviews.targetType, filters.targetType))
  }
  if (filters.targetId) {
    conditions.push(eq(aiReviews.targetId, filters.targetId))
  }

  const rows = await db
    .select()
    .from(aiReviews)
    .where(and(...conditions))
    .orderBy(desc(aiReviews.createdAt))
    .limit(50)

  return rows.map(formatReview)
}

function formatReview(review: typeof aiReviews.$inferSelect) {
  return {
    id: review.id,
    targetType: review.targetType,
    targetId: review.targetId,
    status: review.status,
    model: review.model,
    result: review.result,
    tokensIn: review.tokensIn,
    tokensOut: review.tokensOut,
    costUsd: review.costUsd,
    createdAt: review.createdAt,
  }
}
