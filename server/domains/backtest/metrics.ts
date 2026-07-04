import type {
  BacktestResultSummary,
  EquityPoint,
  SimulatedTrade,
} from '../../../shared/types/backtest'

const SMALL_SAMPLE_THRESHOLD = 30

function mean(values: number[]): number {
  if (values.length === 0) return 0
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function stdDev(values: number[]): number {
  if (values.length < 2) return 0
  const avg = mean(values)
  const variance = values.reduce((sum, value) => sum + (value - avg) ** 2, 0) / (values.length - 1)
  return Math.sqrt(variance)
}

function computeStreaks(pnls: number[]): { longestWin: number; longestLoss: number } {
  let longestWin = 0
  let longestLoss = 0
  let currentWin = 0
  let currentLoss = 0

  for (const pnl of pnls) {
    if (pnl > 0) {
      currentWin += 1
      currentLoss = 0
      longestWin = Math.max(longestWin, currentWin)
    }
    else if (pnl < 0) {
      currentLoss += 1
      currentWin = 0
      longestLoss = Math.max(longestLoss, currentLoss)
    }
    else {
      currentWin = 0
      currentLoss = 0
    }
  }

  return { longestWin, longestLoss }
}

function computeExposurePct(trades: SimulatedTrade[], barCount: number): number | null {
  if (barCount <= 0 || trades.length === 0) return null

  let barsInMarket = 0
  for (const trade of trades) {
    if (!trade.exitTime) continue
    const durationMs = trade.exitTime.getTime() - trade.entryTime.getTime()
    if (durationMs > 0) {
      barsInMarket += 1
    }
  }

  return Math.min(1, barsInMarket / barCount)
}

function computeSharpe(returns: number[]): number | null {
  if (returns.length < 2) return null
  const avg = mean(returns)
  const sd = stdDev(returns)
  if (sd === 0) return null
  return (avg / sd) * Math.sqrt(returns.length)
}

function computeSortino(returns: number[]): number | null {
  if (returns.length < 2) return null
  const avg = mean(returns)
  const downside = returns.filter(value => value < 0)
  if (downside.length === 0) return null
  const downsideDev = Math.sqrt(
    downside.reduce((sum, value) => sum + value ** 2, 0) / downside.length,
  )
  if (downsideDev === 0) return null
  return (avg / downsideDev) * Math.sqrt(returns.length)
}

function equityReturns(points: EquityPoint[]): number[] {
  const returns: number[] = []
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1]!.equity
    const curr = points[i]!.equity
    if (prev > 0) {
      returns.push((curr - prev) / prev)
    }
  }
  return returns
}

function monthKey(date: Date): string {
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}

export function computeRegimeBreakdown(
  equityPoints: EquityPoint[],
): Record<string, { returnPct: number }> {
  if (equityPoints.length < 2) return {}

  const byMonth = new Map<string, EquityPoint[]>()
  for (const point of equityPoints) {
    const key = monthKey(point.time)
    const bucket = byMonth.get(key) ?? []
    bucket.push(point)
    byMonth.set(key, bucket)
  }

  const breakdown: Record<string, { returnPct: number }> = {}
  for (const [month, points] of byMonth) {
    const startEquity = points[0]!.equity
    const endEquity = points[points.length - 1]!.equity
    if (startEquity > 0) {
      breakdown[month] = { returnPct: (endEquity - startEquity) / startEquity }
    }
  }

  return breakdown
}

function computeMaxDrawdown(points: EquityPoint[]): number | null {
  if (points.length === 0) return null
  return Math.max(...points.map(point => point.drawdown))
}

export function calculateMetrics(input: {
  trades: SimulatedTrade[]
  equityPoints: EquityPoint[]
  startingCapital: number
  barCount: number
}): BacktestResultSummary {
  const { trades, equityPoints, startingCapital, barCount } = input
  const closedTrades = trades.filter(trade => trade.pnl !== undefined)
  const pnls = closedTrades.map(trade => trade.pnl!)
  const wins = pnls.filter(pnl => pnl > 0)
  const losses = pnls.filter(pnl => pnl < 0)

  const grossProfit = wins.reduce((sum, pnl) => sum + pnl, 0)
  const grossLoss = Math.abs(losses.reduce((sum, pnl) => sum + pnl, 0))

  const finalEquity = equityPoints.at(-1)?.equity ?? startingCapital
  const totalReturn = startingCapital > 0 ? (finalEquity - startingCapital) / startingCapital : null

  const firstTime = equityPoints[0]?.time
  const lastTime = equityPoints.at(-1)?.time
  let cagr: number | null = null
  if (firstTime && lastTime && startingCapital > 0 && finalEquity > 0) {
    const years = (lastTime.getTime() - firstTime.getTime()) / (365.25 * 24 * 60 * 60 * 1000)
    if (years > 0) {
      cagr = (finalEquity / startingCapital) ** (1 / years) - 1
    }
  }

  const qualityWarnings: string[] = []
  if (closedTrades.length < SMALL_SAMPLE_THRESHOLD) {
    qualityWarnings.push('small_sample')
  }

  const streaks = computeStreaks(pnls)
  const returns = equityReturns(equityPoints)
  const regimeBreakdown = computeRegimeBreakdown(equityPoints)

  return {
    tradeCount: closedTrades.length,
    winRate: closedTrades.length > 0 ? wins.length / closedTrades.length : null,
    profitFactor: grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? null : null,
    expectancy: closedTrades.length > 0 ? mean(pnls) : null,
    totalReturn,
    cagr,
    maxDrawdown: computeMaxDrawdown(equityPoints),
    sharpe: computeSharpe(returns),
    sortino: computeSortino(returns),
    avgWin: wins.length > 0 ? mean(wins) : null,
    avgLoss: losses.length > 0 ? mean(losses) : null,
    exposurePct: computeExposurePct(closedTrades, barCount),
    longestWinStreak: streaks.longestWin,
    longestLossStreak: streaks.longestLoss,
    regimeBreakdown,
    qualityWarnings,
  }
}
