import { describe, expect, it } from 'vitest'
import { compileRuleAst } from '../server/domains/strategy/compiler'
import { ema, rsi } from '../server/domains/strategy/indicators'
import type { RuleAst } from '../shared/types/strategy'

function buildCandles(closes: number[]) {
  const open = closes.map((close, index) => (index === 0 ? close : closes[index - 1]!))
  const high = closes.map((close, index) => Math.max(close, open[index]!))
  const low = closes.map((close, index) => Math.min(close, open[index]!))
  const volume = closes.map(() => 1000)

  return { open, high, low, close: closes, volume }
}

describe('strategy compiler', () => {
  it('evaluates EMA compare conditions on known data', () => {
    const closes = [10, 11, 12, 13, 14, 15, 16, 17, 18, 19]
    const ctx = buildCandles(closes)
    const ema3 = ema(closes, 3)

    const ast: RuleAst = {
      signals: [
        {
          id: 'ema-above-12',
          name: 'EMA above 12',
          kind: 'entry_long',
          logic: 'all',
          conditions: [
            {
              type: 'indicator_compare',
              left: { indicator: 'ema', params: { period: 3 } },
              op: 'gt',
              right: 12,
            },
          ],
        },
      ],
    }

    const compiled = compileRuleAst(ast, ctx)
    const firingBars = closes
      .map((_, index) => ({ index, fired: compiled.evaluateBar(index).signals }))
      .filter(bar => bar.fired.includes('ema-above-12'))

    expect(ema3.filter(value => value > 12).length).toBeGreaterThan(0)
    expect(firingBars.length).toBeGreaterThan(0)
    expect(firingBars.every(bar => ema3[bar.index]! > 12)).toBe(true)
  })

  it('evaluates RSI crossover conditions', () => {
    const closes = [
      44, 44.34, 44.09, 43.61, 44.33, 44.83, 45.10, 45.42, 45.84, 46.08,
      45.89, 46.03, 45.61, 46.28, 46.28, 46.00, 46.03, 46.41, 46.22, 45.64,
    ]
    const ctx = buildCandles(closes)
    const rsi2 = rsi(closes, 2)
    const rsi3 = rsi(closes, 3)

    const ast: RuleAst = {
      signals: [
        {
          id: 'rsi-cross-up',
          name: 'RSI(2) crosses above RSI(3)',
          kind: 'entry_long',
          logic: 'all',
          conditions: [
            {
              type: 'crossover',
              a: { indicator: 'rsi', params: { period: 2 } },
              b: { indicator: 'rsi', params: { period: 3 } },
              direction: 'above',
            },
          ],
        },
      ],
    }

    const compiled = compileRuleAst(ast, ctx)
    const crossoverBars: number[] = []

    for (let index = 1; index < closes.length; index++) {
      const prevA = rsi2[index - 1]!
      const prevB = rsi3[index - 1]!
      const currA = rsi2[index]!
      const currB = rsi3[index]!
      if (Number.isFinite(prevA) && Number.isFinite(prevB) && Number.isFinite(currA) && Number.isFinite(currB)) {
        if (prevA <= prevB && currA > currB) {
          crossoverBars.push(index)
        }
      }
    }

    expect(crossoverBars.length).toBeGreaterThan(0)
    for (const index of crossoverBars) {
      expect(compiled.evaluateBar(index).signals).toContain('rsi-cross-up')
    }
  })

  it('compiles and evaluates multiple signals on fixture candles', () => {
    const closes = [100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 110]
    const ctx = buildCandles(closes)

    const ast: RuleAst = {
      signals: [
        {
          id: 'close-above-105',
          name: 'Close above 105',
          kind: 'filter',
          logic: 'all',
          conditions: [
            {
              type: 'indicator_compare',
              left: { indicator: 'sma', params: { period: 1 } },
              op: 'gt',
              right: 105,
            },
          ],
        },
        {
          id: 'ema-rising',
          name: 'Fast EMA above slow EMA',
          kind: 'entry_long',
          logic: 'all',
          conditions: [
            {
              type: 'indicator_compare',
              left: { indicator: 'ema', params: { period: 2 } },
              op: 'gt',
              right: { indicator: 'ema', params: { period: 4 } },
            },
          ],
        },
      ],
    }

    const compiled = compileRuleAst(ast, ctx)
    const lastBar = compiled.evaluateBar(closes.length - 1)

    expect(lastBar.signals).toContain('close-above-105')
    expect(lastBar.signals).toContain('ema-rising')
  })
})
