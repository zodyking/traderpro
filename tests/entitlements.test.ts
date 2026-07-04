import { describe, expect, it, vi, beforeEach } from 'vitest'

// Mock useDb and schema imports before importing the module under test
const mockDb = {
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
}

const chainable = {
  from: vi.fn(),
  innerJoin: vi.fn(),
  where: vi.fn(),
  limit: vi.fn(),
  values: vi.fn(),
  onConflictDoUpdate: vi.fn(),
  set: vi.fn(),
  returning: vi.fn(),
}

// Each chain method returns itself or the next step
for (const key of Object.keys(chainable)) {
  ;(chainable as Record<string, unknown>)[key] = vi.fn().mockReturnValue(chainable)
}

vi.mock('../server/utils/db', () => ({
  useDb: () => mockDb,
}))

// eslint-disable-next-line import/first -- must load after vi.mock
import { getUserPlan, checkUsage, incrementUsage, checkAiCredits } from '../server/domains/billing/entitlements'

describe('getUserPlan', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns free defaults when no subscription row is found', async () => {
    const emptyChain = {
      from: vi.fn().mockReturnThis(),
      innerJoin: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]),
    }
    mockDb.select.mockReturnValue(emptyChain)

    const plan = await getUserPlan('user-1')

    expect(plan.planId).toBe('free')
    expect(plan.label).toBe('Free')
    expect(plan.limits.backtestsPerMonth).toBe(10)
    expect(plan.limits.aiCredits).toBe(5)
    expect(plan.limits.scannerSymbols).toBe(5)
  })

  it('returns subscription plan when active subscription exists', async () => {
    const subscriptionRow = {
      plan: {
        id: 'pro',
        label: 'Pro',
        limits: { backtestsPerMonth: 100, aiCredits: 50, scannerSymbols: 100 },
      },
    }
    const subChain = {
      from: vi.fn().mockReturnThis(),
      innerJoin: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([subscriptionRow]),
    }
    mockDb.select.mockReturnValue(subChain)

    const plan = await getUserPlan('user-pro')

    expect(plan.planId).toBe('pro')
    expect(plan.label).toBe('Pro')
    expect(plan.limits.backtestsPerMonth).toBe(100)
    expect(plan.limits.aiCredits).toBe(50)
  })
})

describe('checkUsage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('reports allowed=true when under limit', async () => {
    const subChain = {
      from: vi.fn().mockReturnThis(),
      innerJoin: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]),
    }
    const usageChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([{ used: 3 }]),
    }
    mockDb.select
      .mockReturnValueOnce(subChain)
      .mockReturnValueOnce(usageChain)

    const result = await checkUsage('user-1', 'backtestsPerMonth')

    expect(result.allowed).toBe(true)
    expect(result.used).toBe(3)
    expect(result.limit).toBe(10)
  })

  it('reports allowed=false when at or over limit', async () => {
    const subChain = {
      from: vi.fn().mockReturnThis(),
      innerJoin: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]),
    }
    const usageChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([{ used: 10 }]),
    }
    mockDb.select
      .mockReturnValueOnce(subChain)
      .mockReturnValueOnce(usageChain)

    const result = await checkUsage('user-1', 'backtestsPerMonth')

    expect(result.allowed).toBe(false)
    expect(result.used).toBe(10)
    expect(result.limit).toBe(10)
  })

  it('reports used=0 when no counter row exists', async () => {
    const subChain = {
      from: vi.fn().mockReturnThis(),
      innerJoin: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]),
    }
    const usageChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]),
    }
    mockDb.select
      .mockReturnValueOnce(subChain)
      .mockReturnValueOnce(usageChain)

    const result = await checkUsage('user-1', 'aiCredits')

    expect(result.used).toBe(0)
    expect(result.allowed).toBe(true)
  })
})

describe('checkAiCredits', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('delegates to checkUsage for aiCredits metric', async () => {
    const subChain = {
      from: vi.fn().mockReturnThis(),
      innerJoin: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]),
    }
    const usageChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([{ used: 2 }]),
    }
    mockDb.select
      .mockReturnValueOnce(subChain)
      .mockReturnValueOnce(usageChain)

    const result = await checkAiCredits('user-1')

    expect(result.limit).toBe(5)
    expect(result.used).toBe(2)
    expect(result.allowed).toBe(true)
  })
})

describe('incrementUsage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('calls insert with upsert on conflict', async () => {
    const insertChain = {
      values: vi.fn().mockReturnThis(),
      onConflictDoUpdate: vi.fn().mockResolvedValue(undefined),
    }
    mockDb.insert.mockReturnValue(insertChain)

    await incrementUsage('user-1', 'backtestsPerMonth')

    expect(mockDb.insert).toHaveBeenCalled()
    expect(insertChain.values).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        metric: 'backtestsPerMonth',
        used: 1,
      }),
    )
    expect(insertChain.onConflictDoUpdate).toHaveBeenCalled()
  })
})
