import { defineStore } from 'pinia'
import type { AIReviewResult } from '#shared/types/ai'

export type ReviewStatus = 'idle' | 'loading' | 'done' | 'failed'

export type AIReviewRecord = {
  id: string
  targetType: string
  targetId: string
  status: string
  model: string
  result: AIReviewResult | null
  tokensIn: number | null
  tokensOut: number | null
  costUsd: string | null
  createdAt: string
}

export const useAIStore = defineStore('ai', () => {
  const reviews = ref<Map<string, AIReviewRecord>>(new Map())
  const requestStatus = ref<Map<string, ReviewStatus>>(new Map())
  const requestError = ref<Map<string, string>>(new Map())

  function statusFor(targetId: string): ReviewStatus {
    return requestStatus.value.get(targetId) ?? 'idle'
  }

  function errorFor(targetId: string): string | null {
    return requestError.value.get(targetId) ?? null
  }

  function reviewFor(targetId: string): AIReviewRecord | null {
    return reviews.value.get(targetId) ?? null
  }

  async function requestReview(
    targetType: 'strategy' | 'trade' | 'risk' | 'lesson' | 'market',
    targetId: string,
    reviewType?: 'strategy' | 'trade' | 'risk' | 'lesson' | 'market',
  ) {
    requestStatus.value.set(targetId, 'loading')
    requestError.value.delete(targetId)

    try {
      const data = await $fetch<AIReviewRecord>('/api/ai/reviews', {
        method: 'POST',
        body: { targetType, targetId, reviewType },
      })

      reviews.value.set(targetId, normalizeReview(data))
      requestStatus.value.set(targetId, 'done')
      return reviews.value.get(targetId)!
    }
    catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'AI review failed'
      requestError.value.set(targetId, msg)
      requestStatus.value.set(targetId, 'failed')
      throw err
    }
  }

  async function fetchReview(reviewId: string) {
    const data = await $fetch<AIReviewRecord>(`/api/ai/reviews/${reviewId}`)
    const review = normalizeReview(data)
    reviews.value.set(review.targetId, review)
    return review
  }

  async function loadReviewsFor(
    targetType: 'strategy' | 'trade' | 'risk' | 'lesson' | 'market',
    targetId: string,
  ) {
    try {
      const data = await $fetch<{ reviews: AIReviewRecord[] }>('/api/ai/reviews', {
        query: { targetType, targetId },
      })

      for (const item of data.reviews) {
        const normalized = normalizeReview(item)
        const existing = reviews.value.get(targetId)
        if (!existing || new Date(normalized.createdAt) > new Date(existing.createdAt)) {
          reviews.value.set(targetId, normalized)
        }
      }

      if (data.reviews.length > 0) {
        requestStatus.value.set(targetId, 'done')
      }
    }
    catch {
      // best effort
    }
  }

  function clearFor(targetId: string) {
    reviews.value.delete(targetId)
    requestStatus.value.delete(targetId)
    requestError.value.delete(targetId)
  }

  return {
    reviews,
    statusFor,
    errorFor,
    reviewFor,
    requestReview,
    fetchReview,
    loadReviewsFor,
    clearFor,
  }
})

function normalizeReview(raw: AIReviewRecord): AIReviewRecord {
  return {
    id: raw.id,
    targetType: raw.targetType,
    targetId: raw.targetId,
    status: raw.status,
    model: raw.model,
    result: raw.result ?? null,
    tokensIn: raw.tokensIn ?? null,
    tokensOut: raw.tokensOut ?? null,
    costUsd: raw.costUsd ?? null,
    createdAt: typeof raw.createdAt === 'object' && raw.createdAt !== null && 'toISOString' in raw.createdAt
      ? (raw.createdAt as Date).toISOString()
      : String(raw.createdAt),
  }
}
