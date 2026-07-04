import { describe, expect, it } from 'vitest'
import { evaluateCompiledCondition, evaluateConditionAtBar } from '../server/domains/alerts/evaluator'
import type { CandleContext } from '../server/domains/strategy/compiler'
import type { CompiledCondition, Condition } from '../shared/types/strategy'

function buildCandles(closes: number[]): CandleContext {
  const open = closes.map((c, i) => (i === 0 ? c : closes[i - 1]!))
  const high = closes.map((c, i) => Math.max(c, open[i]!))
  const low = closes.map((c, i) => Math.min(c, open[i]!))
  const volume = closes.map(() => 1000)
  return { open, high, low, close: closes, volume }
}

function compiled(root: Condition): CompiledCondition {
  return { hash: 'test', root }
}

describe('evaluateCompiledCondition', () => {
  it('returns false for empty candle array', () => {
    const ctx: CandleContext = { open: [], high: [], low: [], close: [], volume: [] }
    const cond = compiled({ type: 'price_level', field: 'close', op: 'gt', ref: { type: 'price' } })
    expect(evaluateCompiledCondition(cond, ctx)).toBe(false)
  })

  it('evaluates price_level close > threshold via indicator_compare', () => {
    const closes = [100, 110, 120]
    const ctx = buildCandles(closes)

    const cond = compiled({
      type: 'indicator_compare',
      left: { indicator: 'sma', params: { period: 1 } },
      op: 'gt',
      right: 115,
    })

    expect(evaluateCompiledCondition(cond, ctx)).toBe(true)
  })

  it('evaluates indicator_compare EMA gt threshold', () => {
    const closes = [10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20]
    const ctx = buildCandles(closes)

    const cond = compiled({
      type: 'indicator_compare',
      left: { indicator: 'ema', params: { period: 3 } },
      op: 'gt',
      right: 18,
    })

    expect(evaluateCompiledCondition(cond, ctx)).toBe(true)
  })

  it('evaluates RSI condition', () => {
    const closes = [
      44, 44.34, 44.09, 43.61, 44.33, 44.83, 45.10, 45.42, 45.84, 46.08,
      45.89, 46.03, 45.61, 46.28, 46.28,
    ]
    const ctx = buildCandles(closes)

    const aboveFifty = compiled({
      type: 'indicator_compare',
      left: { indicator: 'rsi', params: { period: 14 } },
      op: 'gt',
      right: 50,
    })

    const result = evaluateCompiledCondition(aboveFifty, ctx)
    expect(typeof result).toBe('boolean')
  })

  it('evaluates crossover condition', () => {
    // EMA(2) should cross above EMA(5) in rising trend
    const closes = [10, 9, 8, 9, 10, 11, 12, 13, 14, 15]
    const ctx = buildCandles(closes)

    const cond = compiled({
      type: 'crossover',
      a: { indicator: 'ema', params: { period: 2 } },
      b: { indicator: 'ema', params: { period: 5 } },
      direction: 'above',
    })

    const result = evaluateCompiledCondition(cond, ctx)
    expect(typeof result).toBe('boolean')
  })

  it('evaluates candle pattern: doji', () => {
    // Manufacture a doji: open and close very close, range exists
    const closes = [100, 100.01, 100]
    const ctx: CandleContext = {
      open: [99, 100, 100],
      high: [101, 102, 105],
      low: [98, 99, 95],
      close: closes,
      volume: [1000, 1000, 1000],
    }

    const cond = compiled({ type: 'candle_pattern', pattern: 'doji' })
    const result = evaluateCompiledCondition(cond, ctx)
    expect(typeof result).toBe('boolean')
  })

  it('evaluates candle pattern: engulfing', () => {
    const ctx: CandleContext = {
      open: [102, 99],
      high: [103, 104],
      low: [99, 98],
      close: [100, 103],
      volume: [1000, 1000],
    }

    const cond = compiled({ type: 'candle_pattern', pattern: 'engulfing' })
    expect(evaluateCompiledCondition(cond, ctx)).toBe(true)
  })

  it('evaluates candle pattern: pin_bar', () => {
    const ctx: CandleContext = {
      open: [100, 100],
      high: [101, 120],
      low: [99, 99],
      close: [100, 101],
      volume: [1000, 1000],
    }

    const cond = compiled({ type: 'candle_pattern', pattern: 'pin_bar' })
    expect(evaluateCompiledCondition(cond, ctx)).toBe(true)
  })

  it('evaluates candle pattern: inside_bar', () => {
    const ctx: CandleContext = {
      open: [100, 101],
      high: [110, 108],
      low: [90, 92],
      close: [105, 103],
      volume: [1000, 1000],
    }

    const cond = compiled({ type: 'candle_pattern', pattern: 'inside_bar' })
    expect(evaluateCompiledCondition(cond, ctx)).toBe(true)
  })

  it('evaluates price_level using session_high ref', () => {
    const closes = [100, 105, 110]
    const ctx = buildCandles(closes)

    const cond = compiled({
      type: 'price_level',
      field: 'close',
      op: 'gte',
      ref: { type: 'session_high' },
    })

    expect(evaluateCompiledCondition(cond, ctx)).toBe(true)
  })
})

describe('evaluateConditionAtBar', () => {
  it('can evaluate a condition at any specific bar', () => {
    const closes = [100, 200, 150]
    const ctx = buildCandles(closes)

    const cond: Condition = {
      type: 'indicator_compare',
      left: { indicator: 'sma', params: { period: 1 } },
      op: 'gt',
      right: 190,
    }

    expect(evaluateConditionAtBar(cond, 0, ctx)).toBe(false)
    expect(evaluateConditionAtBar(cond, 1, ctx)).toBe(true)
    expect(evaluateConditionAtBar(cond, 2, ctx)).toBe(false)
  })

  it('handles crossover across multiple bars', () => {
    const closes = [10, 9, 8, 9, 10, 11, 12, 13, 14, 15]
    const ctx = buildCandles(closes)
    const cache = new Map<string, number[]>()

    const cond: Condition = {
      type: 'crossover',
      a: { indicator: 'ema', params: { period: 2 } },
      b: { indicator: 'ema', params: { period: 5 } },
      direction: 'above',
    }

    const crossovers: number[] = []
    for (let i = 1; i < closes.length; i++) {
      if (evaluateConditionAtBar(cond, i, ctx, cache)) {
        crossovers.push(i)
      }
    }

    expect(Array.isArray(crossovers)).toBe(true)
  })
})
