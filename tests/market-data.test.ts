import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMockProvider } from '../server/domains/market-data/mock-provider'

const mockDb = {
  select: vi.fn(),
  selectDistinct: vi.fn(),
  insert: vi.fn(),
}

const mockProvider = {
  getHistoricalCandles: vi.fn(),
}

vi.mock('../server/utils/db', () => ({
  useDb: () => mockDb,
}))

vi.mock('../server/utils/redis', () => ({
  useRedis: () => {
    throw new Error('redis unavailable in test')
  },
}))

vi.mock('../server/domains/market-data/index', () => ({
  createMarketDataProvider: () => mockProvider,
}))

// eslint-disable-next-line import/first -- must load after vi.mock
import {
  getCandles,
  isCandleCoverageSufficient,
  persistQuoteSnapshot,
} from '../server/domains/market-data/service'
// eslint-disable-next-line import/first -- must load after vi.mock
import { collectWatchlistSymbolIds, runMarketIngest } from '../worker/market-ingester'

function buildSelectChain(result: unknown) {
  return {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockResolvedValue(result),
    limit: vi.fn().mockResolvedValue(result),
  }
}

function buildDistinctChain(result: unknown) {
  return {
    from: vi.fn().mockResolvedValue(result),
  }
}

function buildInsertChain() {
  const chain = {
    values: vi.fn().mockReturnThis(),
    onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
    onConflictDoUpdate: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([]),
  }
  return chain
}

const SYMBOL_ID = '11111111-1111-7111-8111-111111111111'
const symbolRecord = {
  id: SYMBOL_ID,
  providerId: 'csv',
  exchange: 'NASDAQ',
  ticker: 'AAPL',
  assetClass: 'stock',
  currency: 'USD',
  meta: { description: 'Apple Inc.' },
}

describe('MockMarketDataProvider', () => {
  it('returns healthy provider status', async () => {
    const provider = createMockProvider()
    const health = await provider.healthCheck()

    expect(health.status).toBe('healthy')
    expect(health.provider).toBe('csv')
  })

  it('searches symbols by ticker', async () => {
    const provider = createMockProvider()
    const results = await provider.searchSymbols('AAPL')

    expect(results.length).toBeGreaterThan(0)
    expect(results[0]?.ticker).toBe('AAPL')
  })

  it('returns historical candles for a range', async () => {
    const provider = createMockProvider()
    const series = await provider.getHistoricalCandles({
      symbol: {
        provider: 'csv',
        exchange: 'NASDAQ',
        ticker: 'AAPL',
        assetClass: 'stock',
      },
      interval: '1m',
      from: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
      to: new Date().toISOString(),
    })

    expect(series.candles.length).toBeGreaterThan(0)
    expect(series.candles[0]?.open).toBeTypeOf('number')
  })
})

describe('isCandleCoverageSufficient', () => {
  it('returns false for empty rows', () => {
    expect(isCandleCoverageSufficient([], '2024-01-01T00:00:00.000Z', '2024-01-02T00:00:00.000Z')).toBe(false)
  })

  it('returns true when rows span the requested range', () => {
    const rows = [
      { time: new Date('2024-01-01T00:00:00.000Z') },
      { time: new Date('2024-01-01T12:00:00.000Z') },
      { time: new Date('2024-01-02T00:00:00.000Z') },
    ]

    expect(isCandleCoverageSufficient(rows, '2024-01-01T00:00:00.000Z', '2024-01-02T00:00:00.000Z')).toBe(true)
  })

  it('returns false when rows only cover part of the range', () => {
    const rows = [
      { time: new Date('2024-01-01T00:00:00.000Z') },
      { time: new Date('2024-01-01T01:00:00.000Z') },
    ]

    expect(isCandleCoverageSufficient(rows, '2024-01-01T00:00:00.000Z', '2024-01-05T00:00:00.000Z')).toBe(false)
  })
})

describe('getCandles', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockProvider.getHistoricalCandles.mockReset()
  })

  it('returns candles from DB when coverage is sufficient', async () => {
    const from = '2024-01-01T00:00:00.000Z'
    const to = '2024-01-02T00:00:00.000Z'
    const dbRows = [
      {
        time: new Date('2024-01-01T00:00:00.000Z'),
        open: 100,
        high: 101,
        low: 99,
        close: 100.5,
        volume: 1000,
      },
      {
        time: new Date('2024-01-02T00:00:00.000Z'),
        open: 100.5,
        high: 102,
        low: 100,
        close: 101,
        volume: 1200,
      },
    ]

    mockDb.select
      .mockReturnValueOnce(buildSelectChain([symbolRecord]))
      .mockReturnValueOnce(buildSelectChain(dbRows))

    const payload = await getCandles({
      symbolId: SYMBOL_ID,
      interval: '1h',
      from,
      to,
    })

    expect(payload.candles).toHaveLength(2)
    expect(payload.candles[0]?.open).toBe(100)
    expect(mockProvider.getHistoricalCandles).not.toHaveBeenCalled()
  })

  it('falls back to provider when DB coverage is insufficient', async () => {
    const from = '2024-01-01T00:00:00.000Z'
    const to = '2024-01-05T00:00:00.000Z'

    mockDb.select
      .mockReturnValueOnce(buildSelectChain([symbolRecord]))
      .mockReturnValueOnce(buildSelectChain([
        {
          time: new Date('2024-01-01T00:00:00.000Z'),
          open: 100,
          high: 101,
          low: 99,
          close: 100.5,
          volume: 1000,
        },
      ]))

    mockProvider.getHistoricalCandles.mockResolvedValue({
      symbolId: SYMBOL_ID,
      interval: '1h',
      candles: [
        {
          symbolId: SYMBOL_ID,
          interval: '1h',
          time: '2024-01-01T00:00:00.000Z',
          open: 200,
          high: 201,
          low: 199,
          close: 200.5,
          volume: 500,
          source: 'csv',
          ingestionTime: '2024-01-01T00:00:00.000Z',
          qualityFlags: [],
        },
      ],
    })

    const insertChain = buildInsertChain()
    mockDb.insert.mockReturnValue(insertChain)

    const payload = await getCandles({
      symbolId: SYMBOL_ID,
      interval: '1h',
      from,
      to,
    })

    expect(mockProvider.getHistoricalCandles).toHaveBeenCalledOnce()
    expect(payload.candles[0]?.open).toBe(200)
    expect(mockDb.insert).toHaveBeenCalled()
  })
})

describe('persistQuoteSnapshot', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('writes latest quote to quote_snapshots', async () => {
    const insertChain = buildInsertChain()
    mockDb.insert.mockReturnValue(insertChain)

    await persistQuoteSnapshot({
      symbolId: SYMBOL_ID,
      time: '2024-01-01T12:00:00.000Z',
      bid: 99.9,
      ask: 100.1,
      last: 100,
      volumeDay: 1_000_000,
    })

    expect(mockDb.insert).toHaveBeenCalled()
    expect(insertChain.values).toHaveBeenCalledWith({
      symbolId: SYMBOL_ID,
      time: new Date('2024-01-01T12:00:00.000Z'),
      bid: 99.9,
      ask: 100.1,
      last: 100,
      volumeDay: 1_000_000,
    })
  })
})

describe('market ingester', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockProvider.getHistoricalCandles.mockReset()
  })

  it('collects distinct watchlist symbol ids', async () => {
    mockDb.selectDistinct.mockReturnValue(buildDistinctChain([
      { symbolId: 'aaaaaaaa-aaaa-7aaa-8aaa-aaaaaaaaaaaa' },
      { symbolId: 'bbbbbbbb-bbbb-7bbb-8bbb-bbbbbbbbbbbb' },
    ]))

    const symbolIds = await collectWatchlistSymbolIds()

    expect(symbolIds).toEqual([
      'aaaaaaaa-aaaa-7aaa-8aaa-aaaaaaaaaaaa',
      'bbbbbbbb-bbbb-7bbb-8bbb-bbbbbbbbbbbb',
    ])
  })

  it('backfills candles for watchlist symbols', async () => {
    mockDb.selectDistinct.mockReturnValue(buildDistinctChain([{ symbolId: SYMBOL_ID }]))
    mockDb.select
      .mockReturnValueOnce(buildSelectChain([symbolRecord]))
      .mockReturnValueOnce(buildSelectChain([]))

    mockProvider.getHistoricalCandles.mockResolvedValue({
      symbolId: SYMBOL_ID,
      interval: '1h',
      candles: [
        {
          symbolId: SYMBOL_ID,
          interval: '1h',
          time: '2024-01-01T00:00:00.000Z',
          open: 200,
          high: 201,
          low: 199,
          close: 200.5,
          volume: 500,
          source: 'csv',
          ingestionTime: '2024-01-01T00:00:00.000Z',
          qualityFlags: [],
        },
      ],
    })

    const insertChain = buildInsertChain()
    mockDb.insert.mockReturnValue(insertChain)

    const result = await runMarketIngest(['1h'])

    expect(result.symbolCount).toBe(1)
    expect(result.ingested).toBe(1)
    expect(mockProvider.getHistoricalCandles).toHaveBeenCalled()
  })
})
