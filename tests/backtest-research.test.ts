import { describe, expect, it } from 'vitest'
import { percentile, runMonteCarlo } from '../server/domains/backtest/monte-carlo'
import { splitDateRangeIntoFolds } from '../server/domains/backtest/walk-forward-folds'

describe('walk-forward fold splitting', () => {
  it('splits a date range into equal non-overlapping folds', () => {
    const from = '2024-01-01T00:00:00.000Z'
    const to = '2025-01-01T00:00:00.000Z'
    const folds = splitDateRangeIntoFolds(from, to, 4)

    expect(folds).toHaveLength(4)
    expect(folds[0]!.foldIndex).toBe(0)
    expect(folds[0]!.from).toBe(from)
    expect(folds[3]!.to).toBe(to)

    for (let i = 1; i < folds.length; i++) {
      expect(Date.parse(folds[i]!.from)).toBe(Date.parse(folds[i - 1]!.to))
    }
  })

  it('covers the full range without gaps', () => {
    const from = '2023-06-01T00:00:00.000Z'
    const to = '2024-06-01T00:00:00.000Z'
    const folds = splitDateRangeIntoFolds(from, to, 3)

    const totalMs = Date.parse(to) - Date.parse(from)
    const coveredMs = folds.reduce((sum, fold) => {
      return sum + (Date.parse(fold.to) - Date.parse(fold.from))
    }, 0)

    expect(coveredMs).toBe(totalMs)
  })

  it('rejects invalid fold counts and date ranges', () => {
    expect(() => splitDateRangeIntoFolds('2024-01-01', '2024-06-01', 0)).toThrow(/foldCount/)
    expect(() => splitDateRangeIntoFolds('2024-06-01', '2024-01-01', 2)).toThrow(/after start/)
    expect(() => splitDateRangeIntoFolds('invalid', '2024-06-01', 2)).toThrow(/Invalid date range/)
  })
})

describe('monte carlo simulation', () => {
  it('computes percentile statistics', () => {
    expect(percentile([1, 2, 3, 4, 5], 0)).toBe(1)
    expect(percentile([1, 2, 3, 4, 5], 1)).toBe(5)
    expect(percentile([10, 20, 30], 0.5)).toBe(20)
  })

  it('resamples trades and returns return/drawdown distributions', () => {
    let counter = 0
    const random = () => {
      const values = [0, 0.5, 0.99]
      const value = values[counter % values.length]!
      counter += 1
      return value
    }

    const result = runMonteCarlo({
      pnls: [100, -50, 75, -25],
      startingCapital: 10_000,
      iterations: 100,
      random,
    })

    expect(result.iterations).toBe(100)
    expect(result.tradeCount).toBe(4)
    expect(result.returns.p50).toBeTypeOf('number')
    expect(result.maxDrawdown.p50).toBeTypeOf('number')
    expect(result.returns.p5).toBeLessThanOrEqual(result.returns.p95)
    expect(result.maxDrawdown.p5).toBeLessThanOrEqual(result.maxDrawdown.p95)
  })

  it('returns zeros when there are no trades', () => {
    const result = runMonteCarlo({
      pnls: [],
      startingCapital: 10_000,
      iterations: 500,
    })

    expect(result.tradeCount).toBe(0)
    expect(result.returns).toEqual({ p5: 0, p50: 0, p95: 0 })
    expect(result.maxDrawdown).toEqual({ p5: 0, p50: 0, p95: 0 })
  })
})
