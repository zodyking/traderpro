import type { IndicatorOverlay, IndicatorType } from '#shared/types/indicators'

export type IndicatorCandle = {
  time: string
  open: number
  high: number
  low: number
  close: number
  volume?: number
}

export type IndicatorPoint = {
  time: string
  value: number
}

export const CHART_SERIES_PALETTE = [
  '#14E0B8',
  '#38BDF8',
  '#6366F1',
  '#F5A623',
  '#3BEACB',
] as const

export function paletteColor(index: number): string {
  return CHART_SERIES_PALETTE[index % CHART_SERIES_PALETTE.length]!
}

function periodFromParams(params: Record<string, number>, fallback = 14): number {
  return params.period ?? fallback
}

export function computeSma(candles: IndicatorCandle[], period: number): IndicatorPoint[] {
  if (period < 1 || candles.length < period) return []

  const points: IndicatorPoint[] = []

  for (let i = period - 1; i < candles.length; i++) {
    let sum = 0
    for (let j = i - period + 1; j <= i; j++) {
      sum += candles[j]!.close
    }
    points.push({
      time: candles[i]!.time,
      value: sum / period,
    })
  }

  return points
}

export function computeEma(candles: IndicatorCandle[], period: number): IndicatorPoint[] {
  if (period < 1 || candles.length < period) return []

  const multiplier = 2 / (period + 1)
  const points: IndicatorPoint[] = []

  let sum = 0
  for (let i = 0; i < period; i++) {
    sum += candles[i]!.close
  }
  let ema = sum / period
  points.push({
    time: candles[period - 1]!.time,
    value: ema,
  })

  for (let i = period; i < candles.length; i++) {
    ema = (candles[i]!.close - ema) * multiplier + ema
    points.push({
      time: candles[i]!.time,
      value: ema,
    })
  }

  return points
}

export function computeRsi(candles: IndicatorCandle[], period: number): IndicatorPoint[] {
  if (period < 1 || candles.length <= period) return []

  const points: IndicatorPoint[] = []
  let avgGain = 0
  let avgLoss = 0

  for (let i = 1; i <= period; i++) {
    const change = candles[i]!.close - candles[i - 1]!.close
    if (change >= 0) {
      avgGain += change
    }
    else {
      avgLoss += Math.abs(change)
    }
  }

  avgGain /= period
  avgLoss /= period

  const firstRsi = avgLoss === 0 ? 100 : 100 - (100 / (1 + avgGain / avgLoss))
  points.push({
    time: candles[period]!.time,
    value: firstRsi,
  })

  for (let i = period + 1; i < candles.length; i++) {
    const change = candles[i]!.close - candles[i - 1]!.close
    const gain = change > 0 ? change : 0
    const loss = change < 0 ? Math.abs(change) : 0

    avgGain = (avgGain * (period - 1) + gain) / period
    avgLoss = (avgLoss * (period - 1) + loss) / period

    const rsi = avgLoss === 0 ? 100 : 100 - (100 / (1 + avgGain / avgLoss))
    points.push({
      time: candles[i]!.time,
      value: rsi,
    })
  }

  return points
}

export function computeVwap(candles: IndicatorCandle[]): IndicatorPoint[] {
  if (!candles.length) return []

  const points: IndicatorPoint[] = []
  let cumulativeTpVolume = 0
  let cumulativeVolume = 0

  for (const candle of candles) {
    const typicalPrice = (candle.high + candle.low + candle.close) / 3
    const volume = candle.volume ?? 1

    cumulativeTpVolume += typicalPrice * volume
    cumulativeVolume += volume

    points.push({
      time: candle.time,
      value: cumulativeTpVolume / cumulativeVolume,
    })
  }

  return points
}

export function computeAtr(candles: IndicatorCandle[], period: number): IndicatorPoint[] {
  if (period < 1 || candles.length <= period) return []

  const trueRanges: number[] = []

  for (let i = 1; i < candles.length; i++) {
    const current = candles[i]!
    const previousClose = candles[i - 1]!.close
    const tr = Math.max(
      current.high - current.low,
      Math.abs(current.high - previousClose),
      Math.abs(current.low - previousClose),
    )
    trueRanges.push(tr)
  }

  if (trueRanges.length < period) return []

  const points: IndicatorPoint[] = []
  let atr = trueRanges.slice(0, period).reduce((sum, value) => sum + value, 0) / period

  points.push({
    time: candles[period]!.time,
    value: atr,
  })

  for (let i = period; i < trueRanges.length; i++) {
    atr = (atr * (period - 1) + trueRanges[i]!) / period
    points.push({
      time: candles[i + 1]!.time,
      value: atr,
    })
  }

  return points
}

export function computeIndicator(
  candles: IndicatorCandle[],
  type: IndicatorType,
  params: Record<string, number>,
): IndicatorPoint[] {
  switch (type) {
    case 'ema':
      return computeEma(candles, periodFromParams(params, 20))
    case 'sma':
      return computeSma(candles, periodFromParams(params, 50))
    case 'rsi':
      return computeRsi(candles, periodFromParams(params, 14))
    case 'vwap':
      return computeVwap(candles)
    case 'atr':
      return computeAtr(candles, periodFromParams(params, 14))
    default:
      return []
  }
}

export function computeOverlaySeries(
  candles: IndicatorCandle[],
  overlay: IndicatorOverlay,
): IndicatorPoint[] {
  return computeIndicator(candles, overlay.type, overlay.params)
}

export function overlayLabel(overlay: IndicatorOverlay): string {
  const period = overlay.params.period
  switch (overlay.type) {
    case 'ema':
      return `EMA(${period ?? 20})`
    case 'sma':
      return `SMA(${period ?? 50})`
    case 'rsi':
      return `RSI(${period ?? 14})`
    case 'vwap':
      return 'VWAP'
    case 'atr':
      return `ATR(${period ?? 14})`
  }
}
