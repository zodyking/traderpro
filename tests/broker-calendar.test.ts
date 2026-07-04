import { beforeEach, describe, expect, it, vi } from 'vitest'

// ── DB mock wiring ────────────────────────────────────────────────────────────
const mockDb = {
  select: vi.fn(),
}

vi.mock('../server/utils/db', () => ({
  useDb: () => mockDb,
}))

// eslint-disable-next-line import/first -- must load after vi.mock
import { getCalendarPnl } from '../server/domains/broker/service'

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeExec(overrides: {
  id?: string
  rawSymbol?: string
  side?: string
  qty?: number
  price?: number
  fees?: string
  executedAt?: Date
}) {
  return {
    id: overrides.id ?? 'exec-1',
    rawSymbol: overrides.rawSymbol ?? 'AAPL',
    side: overrides.side ?? 'buy',
    qty: overrides.qty ?? 100,
    price: overrides.price ?? 100,
    fees: overrides.fees ?? '0',
    executedAt: overrides.executedAt ?? new Date('2024-01-15T14:00:00Z'),
    accountId: 'acc-1',
    userId: 'user-1',
    symbolId: null,
    orderRef: null,
    sourcePayload: {},
  }
}

function buildSelectChain(rows: ReturnType<typeof makeExec>[]) {
  return {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockResolvedValue(rows),
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('getCalendarPnl - date grouping', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns empty months when there are no executions', async () => {
    mockDb.select.mockReturnValue(buildSelectChain([]))
    const result = await getCalendarPnl('user-1')
    expect(result.months).toHaveLength(0)
  })

  it('groups a closed trade into the correct month', async () => {
    const rows = [
      makeExec({ id: 'e1', side: 'buy', qty: 100, price: 100, executedAt: new Date('2024-03-10T14:00:00Z') }),
      makeExec({ id: 'e2', side: 'sell', qty: 100, price: 110, fees: '1', executedAt: new Date('2024-03-15T14:00:00Z') }),
    ]
    mockDb.select.mockReturnValue(buildSelectChain(rows))

    const result = await getCalendarPnl('user-1')

    expect(result.months).toHaveLength(1)
    expect(result.months[0]!.year).toBe(2024)
    expect(result.months[0]!.month).toBe(3)
  })

  it('records the exit date (sell date) as the trade date', async () => {
    const rows = [
      makeExec({ id: 'e1', side: 'buy', qty: 50, price: 200, executedAt: new Date('2024-06-01T10:00:00Z') }),
      makeExec({ id: 'e2', side: 'sell', qty: 50, price: 220, fees: '0', executedAt: new Date('2024-06-05T15:00:00Z') }),
    ]
    mockDb.select.mockReturnValue(buildSelectChain(rows))

    const result = await getCalendarPnl('user-1')
    const day = result.months[0]!.days[0]!
    expect(day.date).toBe('2024-06-05')
  })

  it('calculates FIFO PnL correctly for a simple buy-then-sell', async () => {
    // buy 100 @ $100, sell 100 @ $110 → PnL = $1000
    const rows = [
      makeExec({ id: 'e1', side: 'buy', qty: 100, price: 100, fees: '0', executedAt: new Date('2024-01-10T09:30:00Z') }),
      makeExec({ id: 'e2', side: 'sell', qty: 100, price: 110, fees: '0', executedAt: new Date('2024-01-15T15:00:00Z') }),
    ]
    mockDb.select.mockReturnValue(buildSelectChain(rows))

    const result = await getCalendarPnl('user-1')
    const day = result.months[0]!.days[0]!
    expect(day.pnl).toBeCloseTo(1000)
    expect(day.trades).toBe(1)
  })

  it('deducts fees from PnL', async () => {
    // buy 10 @ $100, sell 10 @ $110, fees = $5 → PnL = $100 - $5 = $95
    const rows = [
      makeExec({ id: 'e1', side: 'buy', qty: 10, price: 100, fees: '0', executedAt: new Date('2024-02-01T09:30:00Z') }),
      makeExec({ id: 'e2', side: 'sell', qty: 10, price: 110, fees: '5', executedAt: new Date('2024-02-03T15:00:00Z') }),
    ]
    mockDb.select.mockReturnValue(buildSelectChain(rows))

    const result = await getCalendarPnl('user-1')
    const day = result.months[0]!.days[0]!
    expect(day.pnl).toBeCloseTo(95)
  })

  it('sums multiple trades closed on the same day', async () => {
    // Two separate AAPL round-trips both exited on the same day
    const rows = [
      makeExec({ id: 'b1', rawSymbol: 'AAPL', side: 'buy', qty: 10, price: 100, fees: '0', executedAt: new Date('2024-04-01T09:30:00Z') }),
      makeExec({ id: 's1', rawSymbol: 'AAPL', side: 'sell', qty: 10, price: 110, fees: '0', executedAt: new Date('2024-04-05T15:00:00Z') }),
      makeExec({ id: 'b2', rawSymbol: 'MSFT', side: 'buy', qty: 5, price: 300, fees: '0', executedAt: new Date('2024-04-02T09:30:00Z') }),
      makeExec({ id: 's2', rawSymbol: 'MSFT', side: 'sell', qty: 5, price: 320, fees: '0', executedAt: new Date('2024-04-05T15:30:00Z') }),
    ]
    mockDb.select.mockReturnValue(buildSelectChain(rows))

    const result = await getCalendarPnl('user-1')
    const day = result.months[0]!.days[0]!
    // AAPL: 10*(110-100) = 100, MSFT: 5*(320-300) = 100  → total = 200
    expect(day.pnl).toBeCloseTo(200)
    expect(day.trades).toBe(2)
  })

  it('splits trades across multiple months correctly', async () => {
    const rows = [
      makeExec({ id: 'b1', rawSymbol: 'AAPL', side: 'buy', qty: 10, price: 100, fees: '0', executedAt: new Date('2024-01-10T10:00:00Z') }),
      makeExec({ id: 's1', rawSymbol: 'AAPL', side: 'sell', qty: 10, price: 110, fees: '0', executedAt: new Date('2024-01-20T15:00:00Z') }),
      makeExec({ id: 'b2', rawSymbol: 'TSLA', side: 'buy', qty: 5, price: 200, fees: '0', executedAt: new Date('2024-02-05T10:00:00Z') }),
      makeExec({ id: 's2', rawSymbol: 'TSLA', side: 'sell', qty: 5, price: 220, fees: '0', executedAt: new Date('2024-02-15T15:00:00Z') }),
    ]
    mockDb.select.mockReturnValue(buildSelectChain(rows))

    const result = await getCalendarPnl('user-1')
    expect(result.months).toHaveLength(2)

    const jan = result.months.find(m => m.month === 1)
    const feb = result.months.find(m => m.month === 2)
    expect(jan).toBeDefined()
    expect(feb).toBeDefined()
    expect(jan!.totalPnl).toBeCloseTo(100)
    expect(feb!.totalPnl).toBeCloseTo(100)
  })

  it('uses FIFO matching when buy lots are split across multiple buys', async () => {
    // Buy 10 @ $100, then buy 10 @ $120, then sell 20 @ $130
    // FIFO: 10*(130-100) + 10*(130-120) = 300 + 100 = 400
    const rows = [
      makeExec({ id: 'b1', side: 'buy', qty: 10, price: 100, fees: '0', executedAt: new Date('2024-05-01T09:00:00Z') }),
      makeExec({ id: 'b2', side: 'buy', qty: 10, price: 120, fees: '0', executedAt: new Date('2024-05-02T09:00:00Z') }),
      makeExec({ id: 's1', side: 'sell', qty: 20, price: 130, fees: '0', executedAt: new Date('2024-05-10T15:00:00Z') }),
    ]
    mockDb.select.mockReturnValue(buildSelectChain(rows))

    const result = await getCalendarPnl('user-1')
    const day = result.months[0]!.days[0]!
    expect(day.pnl).toBeCloseTo(400)
  })

  it('months are sorted chronologically', async () => {
    const rows = [
      makeExec({ id: 'b3', rawSymbol: 'C', side: 'buy', qty: 1, price: 100, fees: '0', executedAt: new Date('2024-03-01T10:00:00Z') }),
      makeExec({ id: 's3', rawSymbol: 'C', side: 'sell', qty: 1, price: 110, fees: '0', executedAt: new Date('2024-03-20T15:00:00Z') }),
      makeExec({ id: 'b1', rawSymbol: 'A', side: 'buy', qty: 1, price: 100, fees: '0', executedAt: new Date('2024-01-01T10:00:00Z') }),
      makeExec({ id: 's1', rawSymbol: 'A', side: 'sell', qty: 1, price: 110, fees: '0', executedAt: new Date('2024-01-20T15:00:00Z') }),
    ]
    mockDb.select.mockReturnValue(buildSelectChain(rows))

    const result = await getCalendarPnl('user-1')
    expect(result.months[0]!.month).toBeLessThan(result.months[1]!.month)
  })
})

describe('getCalendarPnl - month summary', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('totalPnl is the rounded sum of all day PnLs in the month', async () => {
    const rows = [
      makeExec({ id: 'b1', side: 'buy', qty: 100, price: 100, fees: '0', executedAt: new Date('2024-07-01T10:00:00Z') }),
      makeExec({ id: 's1', side: 'sell', qty: 50, price: 110, fees: '0', executedAt: new Date('2024-07-05T15:00:00Z') }),
      makeExec({ id: 's2', side: 'sell', qty: 50, price: 105, fees: '0', executedAt: new Date('2024-07-10T15:00:00Z') }),
    ]
    mockDb.select.mockReturnValue(buildSelectChain(rows))

    const result = await getCalendarPnl('user-1')
    // Day 5: 50*(110-100) = 500, Day 10: 50*(105-100) = 250, total = 750
    expect(result.months[0]!.totalPnl).toBeCloseTo(750)
  })

  it('days within a month are sorted chronologically', async () => {
    const rows = [
      makeExec({ id: 'b1', side: 'buy', qty: 10, price: 100, fees: '0', executedAt: new Date('2024-08-05T10:00:00Z') }),
      makeExec({ id: 's1', side: 'sell', qty: 10, price: 110, fees: '0', executedAt: new Date('2024-08-20T15:00:00Z') }),
      makeExec({ id: 'b2', rawSymbol: 'MSFT', side: 'buy', qty: 5, price: 300, fees: '0', executedAt: new Date('2024-08-01T09:00:00Z') }),
      makeExec({ id: 's2', rawSymbol: 'MSFT', side: 'sell', qty: 5, price: 310, fees: '0', executedAt: new Date('2024-08-10T15:00:00Z') }),
    ]
    mockDb.select.mockReturnValue(buildSelectChain(rows))

    const result = await getCalendarPnl('user-1')
    const days = result.months[0]!.days
    // Dates should be in ascending order
    for (let i = 1; i < days.length; i++) {
      expect(days[i]!.date > days[i - 1]!.date).toBe(true)
    }
  })
})
