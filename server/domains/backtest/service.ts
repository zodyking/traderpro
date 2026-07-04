import { and, asc, eq, gt, or } from 'drizzle-orm'
import { createHash } from 'node:crypto'
import { v7 as uuidv7 } from 'uuid'
import {
  backtestMetrics,
  backtestRuns,
  backtestTrades,
  equityPoints,
} from '../../../db/schema'
import type { BacktestRunConfig } from '../../../db/schema/backtest'
import type { BacktestCreateInput, RealismConfig } from '../../../shared/schemas/backtest'
import type { BacktestProgressEvent, EquityPoint, SimulatedTrade } from '../../../shared/types/backtest'
import type { CandleInterval } from '../../../shared/types/market'
import type { ExecutionAssumptions } from '../../../shared/types/strategy'
import { getCandles } from '../market-data/service'
import { getStrategyVersion } from '../strategy/service'
import { useDb } from '../../utils/db'
import { useRedis } from '../../utils/redis'
import { calculateMetrics } from './metrics'
import { runMonteCarlo, type MonteCarloResult } from './monte-carlo'
import { checkUsage, incrementUsage } from '../billing/entitlements'
import { trackEvent } from '../analytics/service'
import { queueAuthEmail, notifyBacktestComplete } from '../email/service'
import { getActiveUserById } from '../../utils/auth'
import { enqueueBacktestJob, removeBacktestJob } from './queue'
import { simulateLongOnly, type SimulatorCandle } from './simulator'

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

function hashCandles(candles: SimulatorCandle[]): string {
  const payload = candles.map(candle => `${candle.time}:${candle.close}`).join('|')
  return createHash('sha256').update(payload).digest('hex').slice(0, 16)
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

async function assertRunOwnership(userId: string, runId: string) {
  const db = useDb()
  const [run] = await db
    .select()
    .from(backtestRuns)
    .where(and(eq(backtestRuns.id, runId), eq(backtestRuns.userId, userId)))
    .limit(1)

  if (!run) {
    throw createError({ statusCode: 404, statusMessage: 'Backtest run not found' })
  }

  return run
}

async function isRunCanceled(runId: string): Promise<boolean> {
  const db = useDb()
  const [run] = await db
    .select({ status: backtestRuns.status })
    .from(backtestRuns)
    .where(eq(backtestRuns.id, runId))
    .limit(1)

  return run?.status === 'canceled'
}

function parseNumeric(value: string | null | undefined): number | null {
  if (value == null) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function formatRunSummary(run: typeof backtestRuns.$inferSelect) {
  return {
    id: run.id,
    status: run.status,
    strategyVersionId: run.strategyVersionId,
    config: run.config,
    error: run.error,
    queuedAt: run.queuedAt,
    finishedAt: run.finishedAt,
  }
}

function formatMetricsSummary(row: typeof backtestMetrics.$inferSelect) {
  return {
    tradeCount: row.tradeCount,
    winRate: parseNumeric(row.winRate),
    profitFactor: parseNumeric(row.profitFactor),
    expectancy: parseNumeric(row.expectancy),
    totalReturn: parseNumeric(row.totalReturn),
    cagr: parseNumeric(row.cagr),
    maxDrawdown: parseNumeric(row.maxDrawdown),
    sharpe: parseNumeric(row.sharpe),
    sortino: parseNumeric(row.sortino),
    avgWin: parseNumeric(row.avgWin),
    avgLoss: parseNumeric(row.avgLoss),
    exposurePct: parseNumeric(row.exposurePct),
    longestWinStreak: row.longestWinStreak,
    longestLossStreak: row.longestLossStreak,
    regimeBreakdown: row.regimeBreakdown,
    qualityWarnings: row.qualityWarnings,
  }
}

export async function publishProgress(runId: string, event: BacktestProgressEvent) {
  const channel = `backtest.${runId}.progress`
  const payload = JSON.stringify({
    pct: event.pct,
    stage: event.stage,
    ...(event.eta != null ? { eta: event.eta } : {}),
  })

  try {
    const redis = useRedis()
    await redis.publish(channel, payload)
    await redis.set(`backtest:progress:${runId}`, payload)
  }
  catch {
    // progress is best-effort
  }
}

export async function checkBacktestUsage(userId: string): Promise<{ allowed: boolean; used: number; limit: number }> {
  return checkUsage(userId, 'backtestsPerMonth')
}

export async function enqueueBacktest(userId: string, input: BacktestCreateInput) {
  const usage = await checkBacktestUsage(userId)
  if (!usage.allowed) {
    throw createError({
      statusCode: 429,
      statusMessage: `Backtest limit reached (${usage.used}/${usage.limit} this month)`,
    })
  }

  await getStrategyVersion(userId, input.strategyVersionId)

  const runId = uuidv7()
  const config = {
    symbols: input.symbolIds,
    dateRange: input.dateRange,
    capital: input.capital,
    interval: input.interval,
    realism: input.realism,
  } as BacktestRunConfig & { interval: CandleInterval }

  const db = useDb()
  await db.insert(backtestRuns).values({
    id: runId,
    userId,
    strategyVersionId: input.strategyVersionId,
    status: 'queued',
    config,
    dataSnapshot: {
      provider: 'tradingview',
      candleRangeHashes: {},
    },
  })

  await enqueueBacktestJob(runId)
  await incrementUsage(userId, 'backtestsPerMonth')
  await publishProgress(runId, { pct: 0, stage: 'queued' })

  return { runId }
}

export async function cancelBacktest(userId: string, runId: string) {
  const run = await assertRunOwnership(userId, runId)

  if (run.status !== 'queued' && run.status !== 'running') {
    throw createError({
      statusCode: 400,
      statusMessage: 'Cannot cancel backtest in current state',
    })
  }

  await removeBacktestJob(runId)

  const db = useDb()
  await db
    .update(backtestRuns)
    .set({
      status: 'canceled',
      finishedAt: new Date(),
    })
    .where(eq(backtestRuns.id, runId))

  await publishProgress(runId, { pct: 100, stage: 'done' })

  return { runId, status: 'canceled' as const }
}

export async function runBacktest(runId: string) {
  const db = useDb()
  const [run] = await db.select().from(backtestRuns).where(eq(backtestRuns.id, runId)).limit(1)

  if (!run) {
    throw new Error(`Backtest run ${runId} not found`)
  }

  if (run.status === 'canceled') {
    return
  }

  const config = run.config as BacktestRunConfig & { interval?: CandleInterval }
  const interval = config.interval ?? '1d'

  try {
    await db
      .update(backtestRuns)
      .set({ status: 'running' })
      .where(eq(backtestRuns.id, runId))

    await publishProgress(runId, { pct: 10, stage: 'loading' })

    if (await isRunCanceled(runId)) return

    const version = await getStrategyVersion(run.userId, run.strategyVersionId)
    const symbolIds = config.symbols
    const capitalPerSymbol = config.capital / symbolIds.length

    const allTrades: SimulatedTrade[] = []
    const equityCurves: EquityPoint[][] = []
    const candleRangeHashes: Record<string, string> = {}
    let totalBars = 0

    for (let index = 0; index < symbolIds.length; index++) {
      if (await isRunCanceled(runId)) return

      const symbolId = symbolIds[index]!

      const series = await getCandles({
        symbolId,
        interval,
        from: config.dateRange.from,
        to: config.dateRange.to,
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

      candleRangeHashes[symbolId] = hashCandles(candles)
      totalBars += candles.length

      await publishProgress(runId, { pct: 40, stage: 'simulating' })

      const simulationSettings = resolveSimulationSettings(config.realism, version.assumptions)

      const result = simulateLongOnly({
        symbolId,
        candles,
        rules: version.rules,
        riskModel: version.riskModel,
        startingCapital: capitalPerSymbol,
        ...simulationSettings,
      })

      allTrades.push(...result.trades)
      equityCurves.push(result.equityPoints)
    }

    await publishProgress(runId, { pct: 80, stage: 'computing_metrics' })

    if (await isRunCanceled(runId)) return

    const mergedEquity = mergeEquityCurves(equityCurves, config.capital)
    const metrics = calculateMetrics({
      trades: allTrades,
      equityPoints: mergedEquity,
      startingCapital: config.capital,
      barCount: totalBars,
    })

    await publishProgress(runId, { pct: 90, stage: 'persisting' })

    await db.transaction(async (tx) => {
      await tx.insert(backtestMetrics).values({
        runId,
        tradeCount: metrics.tradeCount,
        winRate: metrics.winRate?.toString() ?? null,
        profitFactor: metrics.profitFactor?.toString() ?? null,
        expectancy: metrics.expectancy?.toString() ?? null,
        totalReturn: metrics.totalReturn?.toString() ?? null,
        cagr: metrics.cagr?.toString() ?? null,
        maxDrawdown: metrics.maxDrawdown?.toString() ?? null,
        sharpe: metrics.sharpe?.toString() ?? null,
        sortino: metrics.sortino?.toString() ?? null,
        avgWin: metrics.avgWin?.toString() ?? null,
        avgLoss: metrics.avgLoss?.toString() ?? null,
        exposurePct: metrics.exposurePct?.toString() ?? null,
        longestWinStreak: metrics.longestWinStreak,
        longestLossStreak: metrics.longestLossStreak,
        regimeBreakdown: metrics.regimeBreakdown,
        qualityWarnings: metrics.qualityWarnings,
      })

      if (allTrades.length > 0) {
        await tx.insert(backtestTrades).values(
          allTrades.map(trade => ({
            id: uuidv7(),
            runId,
            symbolId: trade.symbolId,
            side: trade.side,
            entryTime: trade.entryTime,
            entryPrice: trade.entryPrice,
            exitTime: trade.exitTime ?? null,
            exitPrice: trade.exitPrice ?? null,
            qty: trade.qty,
            pnl: trade.pnl?.toString() ?? null,
            rMultiple: trade.rMultiple?.toString() ?? null,
            exitReason: trade.exitReason ?? null,
            signalSnapshot: trade.signalSnapshot ?? {},
          })),
        )
      }

      if (mergedEquity.length > 0) {
        await tx.insert(equityPoints).values(
          mergedEquity.map(point => ({
            runId,
            time: point.time,
            equity: point.equity.toString(),
            drawdown: point.drawdown.toString(),
          })),
        )
      }

      await tx
        .update(backtestRuns)
        .set({
          status: 'done',
          finishedAt: new Date(),
          dataSnapshot: {
            provider: 'tradingview',
            candleRangeHashes,
          },
        })
        .where(eq(backtestRuns.id, runId))
    })

    await publishProgress(runId, { pct: 100, stage: 'done' })
    await trackEvent(run.userId, 'backtest.complete', {
      runId,
      tradeCount: allTrades.length,
      symbolCount: symbolIds.length,
    })

    const user = await getActiveUserById(run.userId)
    if (user) {
      queueAuthEmail(() => notifyBacktestComplete({
        userId: user.id,
        email: user.email,
        displayName: user.displayName,
        runId,
        runLabel: `Run ${runId.slice(0, 8)}`,
        tradeCount: allTrades.length,
      }))
    }
  }
  catch (error) {
    const message = error instanceof Error ? error.message : 'Backtest failed'
    await db
      .update(backtestRuns)
      .set({
        status: 'failed',
        error: message,
        finishedAt: new Date(),
      })
      .where(eq(backtestRuns.id, runId))

    await publishProgress(runId, { pct: 100, stage: 'failed' })
    throw error
  }
}

export async function getBacktestRun(userId: string, runId: string) {
  const run = await assertRunOwnership(userId, runId)
  const db = useDb()

  const response: {
    run: ReturnType<typeof formatRunSummary>
    metrics?: ReturnType<typeof formatMetricsSummary>
  } = {
    run: formatRunSummary(run),
  }

  if (run.status === 'done') {
    const [metrics] = await db
      .select()
      .from(backtestMetrics)
      .where(eq(backtestMetrics.runId, runId))
      .limit(1)

    if (metrics) {
      response.metrics = formatMetricsSummary(metrics)
    }
  }

  return response
}

export async function listBacktestTrades(
  userId: string,
  runId: string,
  cursor?: string,
  limit = 100,
) {
  await assertRunOwnership(userId, runId)
  const db = useDb()

  const conditions = [eq(backtestTrades.runId, runId)]

  if (cursor) {
    const [cursorTime, cursorId] = Buffer.from(cursor, 'base64url').toString().split('|')
    if (cursorTime && cursorId) {
      conditions.push(
        or(
          gt(backtestTrades.entryTime, new Date(cursorTime)),
          and(
            eq(backtestTrades.entryTime, new Date(cursorTime)),
            gt(backtestTrades.id, cursorId),
          ),
        )!,
      )
    }
  }

  const rows = await db
    .select()
    .from(backtestTrades)
    .where(and(...conditions))
    .orderBy(asc(backtestTrades.entryTime), asc(backtestTrades.id))
    .limit(limit + 1)

  const hasMore = rows.length > limit
  const trades = hasMore ? rows.slice(0, limit) : rows
  const last = trades.at(-1)
  const nextCursor = hasMore && last
    ? Buffer.from(`${last.entryTime.toISOString()}|${last.id}`).toString('base64url')
    : null

  return { trades, nextCursor }
}

export async function getEquityCurve(userId: string, runId: string) {
  await assertRunOwnership(userId, runId)
  const db = useDb()

  const points = await db
    .select()
    .from(equityPoints)
    .where(eq(equityPoints.runId, runId))
    .orderBy(asc(equityPoints.time))

  return { points }
}

export async function runMonteCarloForBacktest(
  userId: string,
  runId: string,
  iterations: number,
): Promise<MonteCarloResult> {
  const run = await assertRunOwnership(userId, runId)

  if (run.status !== 'done') {
    throw createError({ statusCode: 400, statusMessage: 'Backtest run must be complete' })
  }

  const db = useDb()
  const trades = await db
    .select({ pnl: backtestTrades.pnl })
    .from(backtestTrades)
    .where(eq(backtestTrades.runId, runId))
    .orderBy(asc(backtestTrades.entryTime))

  const pnls = trades
    .map(trade => (trade.pnl != null ? Number(trade.pnl) : null))
    .filter((pnl): pnl is number => pnl != null && Number.isFinite(pnl))

  const config = run.config as { capital: number }

  return runMonteCarlo({
    pnls,
    startingCapital: config.capital,
    iterations,
  })
}
