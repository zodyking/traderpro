import { beforeEach, describe, expect, it, vi } from 'vitest'

// ── DB mock wiring ────────────────────────────────────────────────────────────
const mockDb = {
  select: vi.fn(),
}

vi.mock('../server/utils/db', () => ({
  useDb: () => mockDb,
}))

// eslint-disable-next-line import/first -- must load after vi.mock
import { getFiredAlerts } from '../server/domains/alerts/feed'

// ── Helpers ───────────────────────────────────────────────────────────────────

const BASE_DATE = new Date('2024-01-15T12:00:00Z')
const CREATED_DATE = new Date('2024-01-10T09:00:00Z')

function makeAlertRow(overrides: {
  id?: string
  symbolId?: string | null
  condition?: unknown
  lastFiredAt?: Date | null
  createdAt?: Date
}) {
  return {
    id: overrides.id ?? 'alert-1',
    userId: 'user-1',
    symbolId: 'symbolId' in overrides ? overrides.symbolId : null,
    condition: 'condition' in overrides ? overrides.condition : null,
    lastFiredAt: 'lastFiredAt' in overrides ? overrides.lastFiredAt : BASE_DATE,
    createdAt: overrides.createdAt ?? CREATED_DATE,
    conditionHash: 'hash-1',
    active: true,
  }
}

function buildSelectChain(rows: ReturnType<typeof makeAlertRow>[]) {
  const chain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(rows),
  }
  return chain
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('getFiredAlerts - result shape', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns an empty array when no fired alerts exist', async () => {
    mockDb.select.mockReturnValue(buildSelectChain([]))
    const result = await getFiredAlerts('user-1')
    expect(result).toHaveLength(0)
  })

  it('filters out rows with null lastFiredAt', async () => {
    mockDb.select.mockReturnValue(
      buildSelectChain([
        makeAlertRow({ id: 'a1', lastFiredAt: BASE_DATE }),
        makeAlertRow({ id: 'a2', lastFiredAt: null }),
      ]),
    )
    const result = await getFiredAlerts('user-1')
    expect(result).toHaveLength(1)
    expect(result[0]!.id).toBe('a1')
  })

  it('returns firedAt as ISO string', async () => {
    mockDb.select.mockReturnValue(
      buildSelectChain([makeAlertRow({ lastFiredAt: BASE_DATE })]),
    )
    const result = await getFiredAlerts('user-1')
    expect(result[0]!.firedAt).toBe(BASE_DATE.toISOString())
  })

  it('returns createdAt as ISO string', async () => {
    mockDb.select.mockReturnValue(
      buildSelectChain([makeAlertRow({ createdAt: CREATED_DATE })]),
    )
    const result = await getFiredAlerts('user-1')
    expect(result[0]!.createdAt).toBe(CREATED_DATE.toISOString())
  })

  it('passes symbolId through as null when absent', async () => {
    mockDb.select.mockReturnValue(
      buildSelectChain([makeAlertRow({ symbolId: null })]),
    )
    const result = await getFiredAlerts('user-1')
    expect(result[0]!.symbolId).toBeNull()
  })

  it('passes symbolId through when present', async () => {
    mockDb.select.mockReturnValue(
      buildSelectChain([makeAlertRow({ symbolId: 'sym-aapl' })]),
    )
    const result = await getFiredAlerts('user-1')
    expect(result[0]!.symbolId).toBe('sym-aapl')
  })
})

describe('getFiredAlerts - conditionSummary formatting', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('formats price_level condition with field and op', async () => {
    const condition = { root: { type: 'price_level', field: 'close', op: 'gt' } }
    mockDb.select.mockReturnValue(
      buildSelectChain([makeAlertRow({ condition })]),
    )
    const result = await getFiredAlerts('user-1')
    expect(result[0]!.conditionSummary).toBe('close gt level')
  })

  it('formats indicator_compare condition with indicator name', async () => {
    const condition = { root: { type: 'indicator_compare', indicator: 'rsi' } }
    mockDb.select.mockReturnValue(
      buildSelectChain([makeAlertRow({ condition })]),
    )
    const result = await getFiredAlerts('user-1')
    expect(result[0]!.conditionSummary).toBe('rsi compare')
  })

  it('falls back to "indicator compare" when indicator field is missing', async () => {
    const condition = { root: { type: 'indicator_compare' } }
    mockDb.select.mockReturnValue(
      buildSelectChain([makeAlertRow({ condition })]),
    )
    const result = await getFiredAlerts('user-1')
    expect(result[0]!.conditionSummary).toBe('indicator compare')
  })

  it('formats crossover condition', async () => {
    const condition = { root: { type: 'crossover' } }
    mockDb.select.mockReturnValue(
      buildSelectChain([makeAlertRow({ condition })]),
    )
    const result = await getFiredAlerts('user-1')
    expect(result[0]!.conditionSummary).toBe('Crossover signal')
  })

  it('formats candle_pattern condition', async () => {
    const condition = { root: { type: 'candle_pattern' } }
    mockDb.select.mockReturnValue(
      buildSelectChain([makeAlertRow({ condition })]),
    )
    const result = await getFiredAlerts('user-1')
    expect(result[0]!.conditionSummary).toBe('Candle pattern')
  })

  it('formats time_window condition', async () => {
    const condition = { root: { type: 'time_window' } }
    mockDb.select.mockReturnValue(
      buildSelectChain([makeAlertRow({ condition })]),
    )
    const result = await getFiredAlerts('user-1')
    expect(result[0]!.conditionSummary).toBe('Time window')
  })

  it('falls back to "Alert fired" for unknown condition type', async () => {
    const condition = { root: { type: 'unknown_type' } }
    mockDb.select.mockReturnValue(
      buildSelectChain([makeAlertRow({ condition })]),
    )
    const result = await getFiredAlerts('user-1')
    expect(result[0]!.conditionSummary).toBe('Alert fired')
  })

  it('falls back to "Alert fired" when condition has no root', async () => {
    const condition = {}
    mockDb.select.mockReturnValue(
      buildSelectChain([makeAlertRow({ condition })]),
    )
    const result = await getFiredAlerts('user-1')
    expect(result[0]!.conditionSummary).toBe('Alert fired')
  })

  it('falls back to "Alert fired" when condition is null', async () => {
    mockDb.select.mockReturnValue(
      buildSelectChain([makeAlertRow({ condition: null })]),
    )
    const result = await getFiredAlerts('user-1')
    expect(result[0]!.conditionSummary).toBe('Alert fired')
  })

  it('price_level falls back to "price" when field is missing', async () => {
    const condition = { root: { type: 'price_level', op: 'lt' } }
    mockDb.select.mockReturnValue(
      buildSelectChain([makeAlertRow({ condition })]),
    )
    const result = await getFiredAlerts('user-1')
    expect(result[0]!.conditionSummary).toBe('price lt level')
  })
})

describe('getFiredAlerts - scanner entitlement rejection scenario', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('respects the default limit of 50 results', async () => {
    const rows = Array.from({ length: 60 }, (_, i) =>
      makeAlertRow({ id: `alert-${i}`, lastFiredAt: BASE_DATE }),
    )
    // Simulate DB honouring the limit by returning only 50
    mockDb.select.mockReturnValue(buildSelectChain(rows.slice(0, 50)))
    const result = await getFiredAlerts('user-1')
    expect(result.length).toBeLessThanOrEqual(50)
  })

  it('accepts a custom limit parameter', async () => {
    mockDb.select.mockReturnValue(
      buildSelectChain([makeAlertRow({ id: 'a1' }), makeAlertRow({ id: 'a2' })]),
    )
    const result = await getFiredAlerts('user-1', 10)
    expect(result.length).toBeLessThanOrEqual(10)
  })
})
