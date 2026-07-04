import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mockQueueAdd = vi.fn().mockResolvedValue(undefined)

vi.mock('../server/domains/ai/queue', () => ({
  enqueueAiReviewJob: (...args: unknown[]) => mockQueueAdd(...args),
}))

const mockDb = {
  insert: vi.fn(),
  update: vi.fn(),
  select: vi.fn(),
}

const chainable = {
  from: vi.fn(),
  where: vi.fn(),
  limit: vi.fn(),
  values: vi.fn(),
  set: vi.fn(),
}

for (const key of Object.keys(chainable)) {
  ;(chainable as Record<string, unknown>)[key] = vi.fn().mockReturnValue(chainable)
}

vi.mock('../server/utils/db', () => ({
  useDb: () => mockDb,
}))

vi.mock('../server/domains/billing/entitlements', () => ({
  checkAiCredits: vi.fn().mockResolvedValue({ allowed: true, used: 0, limit: 10 }),
  incrementUsage: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../server/domains/ai/factory', () => ({
  getAIProvider: () => ({
    modelName: 'mock-model',
    completeReview: vi.fn().mockResolvedValue({
      text: '{"observations":["ok"]}',
      model: 'mock-model',
      tokensIn: 10,
      tokensOut: 20,
      costUsd: 0.001,
    }),
  }),
}))

vi.mock('../server/domains/ai/packet', () => ({
  buildAIReviewPacket: vi.fn().mockResolvedValue({
    userProfile: { experienceLevel: 'beginner', assetClasses: [], riskLimits: {} },
    dataQuality: { source: 'test', gaps: 0, warnings: [] },
    requestedReviewType: 'trade',
  }),
}))

// eslint-disable-next-line import/first
import { isAiAsyncMode, requestReview } from '../server/domains/ai/service'

describe('isAiAsyncMode', () => {
  const original = process.env.AI_ASYNC

  afterEach(() => {
    if (original === undefined) delete process.env.AI_ASYNC
    else process.env.AI_ASYNC = original
  })

  it('returns true when AI_ASYNC=1', () => {
    process.env.AI_ASYNC = '1'
    expect(isAiAsyncMode()).toBe(true)
  })

  it('returns false when AI_ASYNC is unset', () => {
    delete process.env.AI_ASYNC
    expect(isAiAsyncMode()).toBe(false)
  })
})

describe('requestReview async mode', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.AI_ASYNC = '1'
    mockDb.insert.mockReturnValue(chainable)
  })

  afterEach(() => {
    delete process.env.AI_ASYNC
  })

  it('creates a queued review and enqueues a worker job', async () => {
    const review = await requestReview('user-1', {
      targetType: 'trade',
      targetId: '00000000-0000-7000-8000-000000000001',
    })

    expect(review.status).toBe('queued')
    expect(review.result).toBeNull()
    expect(mockDb.insert).toHaveBeenCalled()
    expect(mockQueueAdd).toHaveBeenCalledWith(expect.any(String))
  })
})
