import { and, eq } from 'drizzle-orm'
import { backtestRuns } from '../../../db/schema'
import type { BacktestRunConfig } from '../../../db/schema/backtest'
import type { RealismConfig } from '../../../shared/schemas/backtest'
import type {
  BacktestResultSummary,
  EquityPoint,
  SimulatedTrade,
} from '../../../shared/types/backtest'
import type { CandleInterval } from '../../../shared/types/market'
import type { ExecutionAssumptions, RiskModel } from '../../../shared/types/strategy'
import { useDb } from '../../utils/db'
import { getCandles } from '../market-data/service'
import { getStrategyVersion } from '../strategy/service'
import { calculateMetrics } from './metrics'
import { simulateLongOnly, type SimulatorCandle } from './simulator'
import { splitDateRangeIntoFolds, type WalkForwardFold } from './walk-forward-folds'

export { splitDateRangeIntoFolds, type WalkForwardFold }

export type WalkForwardFoldResult = {
  foldIndex: number
  dateRange: { from: string; to: string }
  metrics: BacktestResultSummary
}

export type WalkForwardResult = {
  foldCount: number
  folds: WalkForwardFoldResult[]
  aggregate: {
    avgTotalReturn: number | null
    avgMaxDrawdown: number | null
    avgSharpe: number | null
  }
}

export type InlineBacktestInput = {
  userId: string
  strategyVersionId: string
  symbolIds: string[]
  dateRange: { from: string; to: string }
  capital: number
  interval: CandleInterval
  realism?: RealismConfig
  riskModelOverride?: RiskModel
}

function resolveSimulationSettings(
  configRealism?: RealismConfig,
  assumptions?: ExecutionAssumptions,
) {
  let slippagePct = configRealism?.slippagePct
  let feePct = configRealism?.feePct
  let fillModel = configRealism?.fillModel

  if (slippagePct == null && assumptions?.slippage?.type === 'percent') {
    slippagePct = assumptions.slippage.value
  }
  if (feePct == null && assumptions?.fees?.type === 'percent') {
    feePct = assumptions.fees.value
  }
  if (fillModel == null && assumptions?.fillModel) {
    if (assumptions.fillModel === 'next_open' || assumptions.fillModel === 'close_confirmation') {
      fillModel = assumptions.fillModel
    }
  }

  return { slippagePct, feePct, fillModel }
}

function mergeEquityCurves(curves: EquityPoint[][], startingCapital: number): EquityPoint[] {
  if (curves.length === 0) return []
  if (curves.length === 1) return curves[0]!

  const timeSet = new Set<number>()
  for (const curve of curves) {
    for (const point of curve) {
      timeSet.add(point.time.getTime())
    }
  }

  const times = [...timeSet].sort((a, b) => a - b)
  const pointers = curves.map(() => 0)
  const latest = curves.map(() => startingCapital / curves.length)
  let peak = startingCapital
  const merged: EquityPoint[] = []

  for (const time of times) {
    let total = 0
    for (let i = 0; i < curves.length; i++) {
      const curve = curves[i]!
      while (pointers[i]! < curve.length && curve[pointers[i]!]!.time.getTime() <= time) {
        latest[i] = curve[pointers[i]!]!.equity
        pointers[i]! += 1
      }
      total += latest[i]!
    }
    peak = Math.max(peak, total)
    merged.push({
      time: new Date(time),
      equity: total,
      drawdown: peak > 0 ? (peak - total) / peak : 0,
    })
  }

  return merged
}

function averageNullable(values: Array<number | null>): number | null {
  const valid = values.filter((value): value is number => value != null)
  if (valid.length === 0) return null
  return valid.reduce((sum, value) => sum + value, 0) / valid.length
}

export async function runInlineBacktest(input: InlineBacktestInput): Promise<BacktestResultSummary> {
  const version = await getStrategyVersion(input.userId, input.strategyVersionId)
  const riskModel = input.riskModelOverride ?? version.riskModel
  const symbolIds = input.symbolIds
  const capitalPerSymbol = input.capital / symbolIds.length

  const allTrades: SimulatedTrade[] = []
  const equityCurves: EquityPoint[][] = []
  let totalBars = 0
  const simulationSettings = resolveSimulationSettings(input.realism, version.assumptions)

  for (const symbolId of symbolIds) {
    const series = await getCandles({
      symbolId,
      interval: input.interval,
      from: input.dateRange.from,
      to: input.dateRange.to,
    })

    const candles: SimulatorCandle[] = series.candles.map((candle: {
      time: string
      open: number
      high: number
      low: number
      close: number
      volume?: number
    }) => ({
      time: candle.time,
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close,
      volume: candle.volume,
    }))

    totalBars += candles.length

    const result = simulateLongOnly({
      symbolId,
      candles,
      rules: version.rules,
      riskModel,
      startingCapital: capitalPerSymbol,
      ...simulationSettings,
    })

    allTrades.push(...result.trades)
    equityCurves.push(result.equityPoints)
  }

  const mergedEquity = mergeEquityCurves(equityCurves, input.capital)
  return calculateMetrics({
    trades: allTrades,
    equityPoints: mergedEquity,
    startingCapital: input.capital,
    barCount: totalBars,
  })
}

export async function runWalkForward(input: {
  userId: string
  strategyVersionId: string
  symbolIds: string[]
  dateRange: { from: string; to: string }
  capital: number
  interval: CandleInterval
  foldCount: number
  realism?: RealismConfig
}): Promise<WalkForwardResult> {
  await getStrategyVersion(input.userId, input.strategyVersionId)

  const folds = splitDateRangeIntoFolds(input.dateRange.from, input.dateRange.to, input.foldCount)
  const results: WalkForwardFoldResult[] = []

  for (const fold of folds) {
    const metrics = await runInlineBacktest({
      userId: input.userId,
      strategyVersionId: input.strategyVersionId,
      symbolIds: input.symbolIds,
      dateRange: { from: fold.from, to: fold.to },
      capital: input.capital,
      interval: input.interval,
      realism: input.realism,
    })

    results.push({
      foldIndex: fold.foldIndex,
      dateRange: { from: fold.from, to: fold.to },
      metrics,
    })
  }

  return {
    foldCount: input.foldCount,
    folds: results,
    aggregate: {
      avgTotalReturn: averageNullable(results.map(fold => fold.metrics.totalReturn)),
      avgMaxDrawdown: averageNullable(results.map(fold => fold.metrics.maxDrawdown)),
      avgSharpe: averageNullable(results.map(fold => fold.metrics.sharpe)),
    },
  }
}

export async function runWalkForwardFromRun(
  userId: string,
  runId: string,
  foldCount: number,
): Promise<WalkForwardResult> {
  const db = useDb()
  const [run] = await db
    .select()
    .from(backtestRuns)
    .where(and(eq(backtestRuns.id, runId), eq(backtestRuns.userId, userId)))
    .limit(1)

  if (!run) {
    throw createError({ statusCode: 404, statusMessage: 'Backtest run not found' })
  }
  if (run.status !== 'done') {
    throw createError({ statusCode: 400, statusMessage: 'Backtest run must be complete' })
  }

  const config = run.config as BacktestRunConfig & { interval?: CandleInterval }

  return runWalkForward({
    userId,
    strategyVersionId: run.strategyVersionId,
    symbolIds: config.symbols,
    dateRange: config.dateRange,
    capital: config.capital,
    interval: config.interval ?? '1d',
    foldCount,
    realism: config.realism,
  })
}
