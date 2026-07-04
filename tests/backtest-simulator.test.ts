import { describe, expect, it } from 'vitest'
import { simulateLongOnly } from '../server/domains/backtest/simulator'
import type { RuleAst } from '../shared/types/strategy'

function buildCandles(closes: number[], startMs = Date.parse('2024-01-01T00:00:00.000Z')) {
  const dayMs = 24 * 60 * 60 * 1000
  return closes.map((close, index) => {
    const open = index === 0 ? close : closes[index - 1]!
    return {
      time: new Date(startMs + index * dayMs).toISOString(),
      open,
      high: Math.max(open, close) + 0.5,
      low: Math.min(open, close) - 0.5,
      close,
      volume: 1000,
    }
  })
}

describe('backtest simulator', () => {
  it('enters on always-true entry_long at next bar open without look-ahead', () => {
    const candles = buildCandles([100, 101, 102, 103, 104, 105, 106, 107, 108, 109])
    const rules: RuleAst = {
      signals: [
        {
          id: 'always-enter',
          name: 'Always enter',
          kind: 'entry_long',
          logic: 'all',
          conditions: [
            {
              type: 'time_window',
              session: { session: '24h' },
            },
          ],
        },
        {
          id: 'take-profit-exit',
          name: 'Exit after move',
          kind: 'exit',
          logic: 'all',
          conditions: [
            {
              type: 'indicator_compare',
              left: { indicator: 'sma', params: { period: 1 } },
              op: 'gt',
              right: 104,
            },
          ],
        },
      ],
    }

    const result = simulateLongOnly({
      symbolId: 'test-symbol',
      candles,
      rules,
      riskModel: {
        sizingMethod: 'percent_equity',
        takeProfit: { type: 'percent', value: 2 },
      },
      startingCapital: 10_000,
    })

    expect(result.trades.length).toBeGreaterThan(0)

    const firstTrade = result.trades[0]!
    const signalBar = 0
    const entryBar = 1
    expect(firstTrade.entryTime.toISOString()).toBe(candles[entryBar]!.time)
    expect(firstTrade.entryPrice).toBeCloseTo(candles[entryBar]!.open * 1.0005, 4)
    expect(firstTrade.side).toBe('long')

    const signalEvalBar = candles[signalBar]!
    expect(signalEvalBar.close).toBe(100)

    for (const trade of result.trades) {
      expect(trade.exitTime).toBeDefined()
      expect(trade.pnl).toBeDefined()
    }

    expect(result.equityPoints).toHaveLength(candles.length)
    expect(result.finalEquity).toBeGreaterThan(0)
  })

  it('respects stop loss exits before signal exits', () => {
    const candles = buildCandles([100, 99, 98, 97, 96, 95, 94, 93])
    const rules: RuleAst = {
      signals: [
        {
          id: 'always-enter',
          name: 'Always enter',
          kind: 'entry_long',
          logic: 'all',
          conditions: [{ type: 'time_window', session: { session: '24h' } }],
        },
      ],
    }

    const result = simulateLongOnly({
      symbolId: 'test-symbol',
      candles,
      rules,
      riskModel: {
        stopLoss: { type: 'percent', value: 1 },
        takeProfit: { type: 'percent', value: 50 },
      },
      startingCapital: 10_000,
    })

    expect(result.trades.length).toBeGreaterThan(0)
    expect(result.trades.some(trade => trade.exitReason === 'stop_loss')).toBe(true)
  })
})
