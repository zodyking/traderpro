import type { Condition, IndicatorRef, LevelRef, Op, RuleAst } from '../../../shared/types/strategy'
import { atr, ema, rsi, sma, vwap } from './indicators'

export type CandleContext = {
  open: number[]
  high: number[]
  low: number[]
  close: number[]
  volume: number[]
}

export type CompiledStrategy = {
  evaluateBar: (index: number) => { signals: string[] }
}

type IndicatorSeries = Map<string, number[]>

const EQ_WITHIN_EPSILON = 1e-6

function indicatorKey(ref: IndicatorRef): string {
  return JSON.stringify({
    indicator: ref.indicator,
    params: ref.params,
    timeframe: ref.timeframe ?? null,
    offset: ref.offset ?? 0,
  })
}

function resolvePeriod(ref: IndicatorRef, fallback = 14): number {
  return ref.params.period ?? ref.params.length ?? fallback
}

function computeIndicatorSeries(ref: IndicatorRef, ctx: CandleContext, cache: IndicatorSeries): number[] {
  const key = indicatorKey(ref)
  const cached = cache.get(key)
  if (cached) {
    return cached
  }

  const period = resolvePeriod(ref)
  let series: number[]

  switch (ref.indicator) {
    case 'ema':
      series = ema(ctx.close, period)
      break
    case 'sma':
      series = sma(ctx.close, period)
      break
    case 'rsi':
      series = rsi(ctx.close, period)
      break
    case 'vwap':
      series = vwap(ctx.high, ctx.low, ctx.close, ctx.volume)
      break
    case 'atr':
      series = atr(ctx.high, ctx.low, ctx.close, period)
      break
    default:
      series = new Array(ctx.close.length).fill(NaN)
  }

  cache.set(key, series)
  return series
}

function valueAt(series: number[], index: number, offset = 0): number {
  const target = index - offset
  if (target < 0 || target >= series.length) {
    return NaN
  }
  return series[target]!
}

function resolveIndicatorValue(ref: IndicatorRef, index: number, ctx: CandleContext, cache: IndicatorSeries): number {
  const series = computeIndicatorSeries(ref, ctx, cache)
  return valueAt(series, index, ref.offset ?? 0)
}

function resolveLevelValue(ref: LevelRef, index: number, ctx: CandleContext, cache: IndicatorSeries): number {
  if ('indicator' in ref) {
    return resolveIndicatorValue(ref, index, ctx, cache)
  }

  switch (ref.type) {
    case 'price':
      return ctx.close[index]!
    case 'vwap':
      return valueAt(vwap(ctx.high, ctx.low, ctx.close, ctx.volume), index)
    case 'session_high': {
      let max = -Infinity
      for (let i = 0; i <= index; i++) {
        max = Math.max(max, ctx.high[i]!)
      }
      return max
    }
    case 'session_low': {
      let min = Infinity
      for (let i = 0; i <= index; i++) {
        min = Math.min(min, ctx.low[i]!)
      }
      return min
    }
    default:
      return NaN
  }
}

function compareValues(left: number, op: Op, right: number): boolean {
  if (!Number.isFinite(left) || !Number.isFinite(right)) {
    return false
  }

  switch (op) {
    case 'gt':
      return left > right
    case 'gte':
      return left >= right
    case 'lt':
      return left < right
    case 'lte':
      return left <= right
    case 'eq_within':
      return Math.abs(left - right) <= EQ_WITHIN_EPSILON
    default:
      return false
  }
}

function evaluateCandlePattern(
  pattern: Extract<Condition, { type: 'candle_pattern' }>['pattern'],
  index: number,
  ctx: CandleContext,
): boolean {
  if (index < 1) {
    return false
  }

  const open = ctx.open[index]!
  const high = ctx.high[index]!
  const low = ctx.low[index]!
  const close = ctx.close[index]!
  const prevOpen = ctx.open[index - 1]!
  const prevHigh = ctx.high[index - 1]!
  const prevLow = ctx.low[index - 1]!
  const prevClose = ctx.close[index - 1]!
  const body = Math.abs(close - open)
  const range = high - low

  switch (pattern) {
    case 'engulfing':
      return (prevClose < prevOpen && close > open && close >= prevOpen && open <= prevClose)
        || (prevClose > prevOpen && close < open && close <= prevOpen && open >= prevClose)
    case 'pin_bar': {
      const upperWick = high - Math.max(open, close)
      const lowerWick = Math.min(open, close) - low
      return range > 0 && (upperWick >= body * 2 || lowerWick >= body * 2)
    }
    case 'inside_bar':
      return high <= prevHigh && low >= prevLow
    case 'doji':
      return range > 0 && body / range <= 0.1
    default:
      return false
  }
}

function evaluateCondition(
  condition: Condition,
  index: number,
  ctx: CandleContext,
  cache: IndicatorSeries,
): boolean {
  switch (condition.type) {
    case 'indicator_compare': {
      const left = resolveIndicatorValue(condition.left, index, ctx, cache)
      const right = typeof condition.right === 'number'
        ? condition.right
        : resolveIndicatorValue(condition.right, index, ctx, cache)
      return compareValues(left, condition.op, right)
    }
    case 'price_level': {
      const left = ctx[condition.field][index]!
      const right = resolveLevelValue(condition.ref, index, ctx, cache)
      return compareValues(left, condition.op, right)
    }
    case 'crossover': {
      if (index < 1) {
        return false
      }
      const aNow = resolveIndicatorValue(condition.a, index, ctx, cache)
      const bNow = resolveIndicatorValue(condition.b, index, ctx, cache)
      const aPrev = resolveIndicatorValue(condition.a, index - 1, ctx, cache)
      const bPrev = resolveIndicatorValue(condition.b, index - 1, ctx, cache)
      if (![aNow, bNow, aPrev, bPrev].every(Number.isFinite)) {
        return false
      }
      if (condition.direction === 'above') {
        return aPrev <= bPrev && aNow > bNow
      }
      return aPrev >= bPrev && aNow < bNow
    }
    case 'candle_pattern':
      return evaluateCandlePattern(condition.pattern, index, ctx)
    case 'time_window':
      return true
    default:
      return false
  }
}

export function compileRuleAst(ast: RuleAst, ctx: CandleContext): CompiledStrategy {
  const cache: IndicatorSeries = new Map()
  const evaluators = ast.signals.map((signal) => {
    const conditionFns = signal.conditions.map(condition => (index: number) =>
      evaluateCondition(condition, index, ctx, cache))

    return {
      id: signal.id,
      logic: signal.logic,
      evaluate: (index: number) => {
        if (conditionFns.length === 0) {
          return false
        }
        if (signal.logic === 'all') {
          return conditionFns.every(fn => fn(index))
        }
        return conditionFns.some(fn => fn(index))
      },
    }
  })

  return {
    evaluateBar(index: number) {
      const signals = evaluators
        .filter(signal => signal.evaluate(index))
        .map(signal => signal.id)
      return { signals }
    },
  }
}
