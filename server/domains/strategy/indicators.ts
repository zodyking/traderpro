function wilderSmooth(values: number[], period: number): number[] {
  const result: number[] = new Array(values.length).fill(NaN)
  if (values.length < period) {
    return result
  }

  let sum = 0
  for (let i = 0; i < period; i++) {
    sum += values[i]!
  }
  result[period - 1] = sum / period

  for (let i = period; i < values.length; i++) {
    result[i] = ((result[i - 1]! * (period - 1)) + values[i]!) / period
  }

  return result
}

export function sma(values: number[], period: number): number[] {
  const result: number[] = new Array(values.length).fill(NaN)
  if (period < 1) {
    return result
  }

  for (let i = period - 1; i < values.length; i++) {
    let sum = 0
    for (let j = 0; j < period; j++) {
      sum += values[i - j]!
    }
    result[i] = sum / period
  }

  return result
}

export function ema(values: number[], period: number): number[] {
  const result: number[] = new Array(values.length).fill(NaN)
  if (period < 1 || values.length < period) {
    return result
  }

  const multiplier = 2 / (period + 1)
  let sum = 0
  for (let i = 0; i < period; i++) {
    sum += values[i]!
  }
  result[period - 1] = sum / period

  for (let i = period; i < values.length; i++) {
    result[i] = (values[i]! * multiplier) + (result[i - 1]! * (1 - multiplier))
  }

  return result
}

export function rsi(closes: number[], period: number): number[] {
  const result: number[] = new Array(closes.length).fill(NaN)
  if (period < 1 || closes.length <= period) {
    return result
  }

  let avgGain = 0
  let avgLoss = 0
  for (let i = 1; i <= period; i++) {
    const change = closes[i]! - closes[i - 1]!
    if (change >= 0) {
      avgGain += change
    }
    else {
      avgLoss -= change
    }
  }
  avgGain /= period
  avgLoss /= period
  result[period] = avgLoss === 0 ? 100 : 100 - (100 / (1 + avgGain / avgLoss))

  for (let i = period + 1; i < closes.length; i++) {
    const change = closes[i]! - closes[i - 1]!
    const gain = change > 0 ? change : 0
    const loss = change < 0 ? -change : 0
    avgGain = ((avgGain * (period - 1)) + gain) / period
    avgLoss = ((avgLoss * (period - 1)) + loss) / period
    result[i] = avgLoss === 0 ? 100 : 100 - (100 / (1 + avgGain / avgLoss))
  }

  return result
}

export function vwap(
  high: number[],
  low: number[],
  close: number[],
  volume: number[],
): number[] {
  const result: number[] = new Array(close.length).fill(NaN)
  let cumulativeTpv = 0
  let cumulativeVolume = 0

  for (let i = 0; i < close.length; i++) {
    const barVolume = volume[i] ?? 0
    const typicalPrice = (high[i]! + low[i]! + close[i]!) / 3
    cumulativeTpv += typicalPrice * barVolume
    cumulativeVolume += barVolume
    result[i] = cumulativeVolume > 0 ? cumulativeTpv / cumulativeVolume : NaN
  }

  return result
}

export function atr(
  high: number[],
  low: number[],
  close: number[],
  period: number,
): number[] {
  const trueRanges: number[] = []
  for (let i = 0; i < close.length; i++) {
    if (i === 0) {
      trueRanges.push(high[i]! - low[i]!)
    }
    else {
      trueRanges.push(Math.max(
        high[i]! - low[i]!,
        Math.abs(high[i]! - close[i - 1]!),
        Math.abs(low[i]! - close[i - 1]!),
      ))
    }
  }

  return wilderSmooth(trueRanges, period)
}
