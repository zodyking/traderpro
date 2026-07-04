import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockEnqueueBrokerSyncJob = vi.fn().mockResolvedValue(undefined)
const mockImportCsv = vi.fn()

vi.mock('../server/domains/broker/queue', () => ({
  enqueueBrokerSyncJob: (...args: unknown[]) => mockEnqueueBrokerSyncJob(...args),
}))

vi.mock('../server/domains/broker/service', () => ({
  importCsv: (...args: unknown[]) => mockImportCsv(...args),
}))

const mockDb = {
  insert: vi.fn(),
  update: vi.fn(),
  select: vi.fn(),
}

const chainable = {
  from: vi.fn(),
  innerJoin: vi.fn(),
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

// eslint-disable-next-line import/first
import {
  enqueueBrokerSync,
  processBrokerSync,
  resolveConnectionForSync,
} from '../server/domains/broker/sync-service'

const importInput = {
  broker: 'generic' as const,
  label: 'Test Account',
  csv: 'symbol,side,qty,price\nAAPL,buy,1,100',
}

describe('resolveConnectionForSync', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDb.select.mockReturnValue(chainable)
    mockDb.insert.mockReturnValue(chainable)
  })

  it('returns an existing connection id when found', async () => {
    chainable.limit.mockResolvedValueOnce([{ id: 'conn-1' }])

    const connectionId = await resolveConnectionForSync('user-1', importInput)

    expect(connectionId).toBe('conn-1')
    expect(mockDb.insert).not.toHaveBeenCalled()
  })

  it('creates a new connection when none exists', async () => {
    chainable.limit.mockResolvedValueOnce([])

    const connectionId = await resolveConnectionForSync('user-1', importInput)

    expect(connectionId).toMatch(/^[0-9a-f-]{36}$/i)
    expect(mockDb.insert).toHaveBeenCalled()
  })
})

describe('enqueueBrokerSync', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDb.select.mockReturnValue(chainable)
    mockDb.insert.mockReturnValue(chainable)
    mockDb.update.mockReturnValue(chainable)
    chainable.limit.mockResolvedValue([{ id: 'conn-1', userId: 'user-1' }])
  })

  it('creates a queued job row and enqueues work', async () => {
    const result = await enqueueBrokerSync('user-1', 'conn-1', importInput)

    expect(result.jobId).toMatch(/^[0-9a-f-]{36}$/i)
    expect(mockDb.insert).toHaveBeenCalled()
    expect(mockEnqueueBrokerSyncJob).toHaveBeenCalledWith(result.jobId, 'user-1', 'conn-1')
  })
})

describe('processBrokerSync', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDb.select.mockReturnValue(chainable)
    mockDb.update.mockReturnValue(chainable)
    mockImportCsv.mockResolvedValue({
      connectionId: 'conn-1',
      accountId: 'acct-1',
      inserted: 2,
      skipped: 0,
      parseErrors: [],
      unresolvedSymbols: [],
    })
  })

  it('runs CSV import when import payload is present', async () => {
    chainable.limit.mockResolvedValueOnce([{
      id: 'job-1',
      connectionId: 'conn-1',
      status: 'queued',
      stats: { import: importInput },
    }])

    const stats = await processBrokerSync('job-1', 'user-1', 'conn-1')

    expect(mockImportCsv).toHaveBeenCalledWith('user-1', importInput)
    expect(stats.result?.inserted).toBe(2)
    expect(mockDb.update).toHaveBeenCalled()
  })

  it('marks the job done without import when no CSV payload exists', async () => {
    chainable.limit.mockResolvedValueOnce([{
      id: 'job-1',
      connectionId: 'conn-1',
      status: 'queued',
      stats: {},
    }])

    await processBrokerSync('job-1', 'user-1', 'conn-1')

    expect(mockImportCsv).not.toHaveBeenCalled()
    expect(mockDb.update).toHaveBeenCalled()
  })
})
