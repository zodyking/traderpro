import { describe, expect, it } from 'vitest'
import { calculateMetrics, computeRegimeBreakdown } from '../server/domains/backtest/metrics'
import type { EquityPoint, SimulatedTrade } from '../shared/types/backtest'

const startingCapital = 10_000

function makeTrade(pnl: number, index: number): SimulatedTrade {
  const day = String(index + 1).padStart(2, '0')
  return {
    symbolId: '00000000-0000-7000-8000-000000000001',
    side: 'long',
    entryTime: new Date(`2024-0${index + 1}-${day}T10:00:00.000Z`),
    entryPrice: 100,
    exitTime: new Date(`2024-0${index + 1}-${day}T16:00:00.000Z`),
    exitPrice: 100 + pnl,
    qty: 1,
    pnl,
    exitReason: 'signal',
    signalSnapshot: {},
  }
}

describe('backtest metrics calculator', () => {
  it('computes summary stats for known trades', () => {
    const trades = [200, -100, 150, -50].map((pnl, index) => makeTrade(pnl, index))
    const equityPoints: EquityPoint[] = [
      { time: new Date('2024-01-01T00:00:00.000Z'), equity: startingCapital, drawdown: 0 },
      { time: new Date('2024-12-31T23:59:59.999Z'), equity: startingCapital + 200, drawdown: 0 },
    ]

    const metrics = calculateMetrics({
      trades,
      equityPoints,
      startingCapital,
      barCount: 252,
    })

    expect(metrics.tradeCount).toBe(4)
    expect(metrics.winRate).toBe(0.5)
    expect(metrics.profitFactor).toBeCloseTo(2.3333, 4)
    expect(metrics.expectancy).toBe(50)
    expect(metrics.totalReturn).toBeCloseTo(0.02, 4)
    expect(metrics.avgWin).toBe(175)
    expect(metrics.avgLoss).toBe(-75)
    expect(metrics.longestWinStreak).toBe(1)
    expect(metrics.longestLossStreak).toBe(1)
    expect(metrics.qualityWarnings).toContain('small_sample')
  })

  it('returns null rates when there are no trades', () => {
    const metrics = calculateMetrics({
      trades: [],
      equityPoints: [{ time: new Date('2024-01-01T00:00:00.000Z'), equity: startingCapital, drawdown: 0 }],
      startingCapital,
      barCount: 252,
    })

    expect(metrics.tradeCount).toBe(0)
    expect(metrics.winRate).toBeNull()
    expect(metrics.profitFactor).toBeNull()
    expect(metrics.expectancy).toBeNull()
    expect(metrics.totalReturn).toBe(0)
  })

  it('computes monthly regime breakdown from equity curve', () => {
    const equityPoints: EquityPoint[] = [
      { time: new Date('2024-01-01T00:00:00.000Z'), equity: 10_000, drawdown: 0 },
      { time: new Date('2024-01-31T23:59:59.999Z'), equity: 10_500, drawdown: 0 },
      { time: new Date('2024-02-01T00:00:00.000Z'), equity: 10_500, drawdown: 0 },
      { time: new Date('2024-02-29T23:59:59.999Z'), equity: 10_200, drawdown: 0.03 },
    ]

    const breakdown = computeRegimeBreakdown(equityPoints)

    expect(breakdown['2024-01']?.returnPct).toBeCloseTo(0.05, 4)
    expect(breakdown['2024-02']?.returnPct).toBeCloseTo(-0.02857, 4)
  })

  it('includes regime breakdown in calculateMetrics', () => {
    const equityPoints: EquityPoint[] = [
      { time: new Date('2024-01-01T00:00:00.000Z'), equity: startingCapital, drawdown: 0 },
      { time: new Date('2024-01-31T23:59:59.999Z'), equity: startingCapital * 1.1, drawdown: 0 },
    ]

    const metrics = calculateMetrics({
      trades: [],
      equityPoints,
      startingCapital,
      barCount: 22,
    })

    expect(metrics.regimeBreakdown['2024-01']?.returnPct).toBeCloseTo(0.1, 4)
  })
})
