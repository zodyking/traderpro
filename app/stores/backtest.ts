import { defineStore } from 'pinia'
import type { BacktestRunConfig } from '../../db/schema/backtest'
import type { BacktestMetricsSummary, BacktestProgress as BacktestProgressPayload, BacktestRunStatus, BacktestRunSummary } from '#shared/types/backtest'

export type BacktestProgress = BacktestProgressPayload

export type BacktestRun = {
  id: string
  status: BacktestRunStatus
  strategyVersionId?: string
  config?: BacktestRunConfig & { interval?: string }
  error?: string | null
  queuedAt: string
  finishedAt?: string | null
}

export type WalkForwardResult = {
  foldCount: number
  folds: Array<{
    foldIndex: number
    dateRange: { from: string; to: string }
    metrics: BacktestMetricsSummary
  }>
  aggregate: {
    avgTotalReturn: number | null
    avgMaxDrawdown: number | null
    avgSharpe: number | null
  }
}

export type MonteCarloResult = {
  iterations: number
  tradeCount: number
  returns: { p5: number; p50: number; p95: number }
  maxDrawdown: { p5: number; p50: number; p95: number }
}

export type BacktestMetrics = BacktestMetricsSummary
export type { BacktestMetricsSummary }

export type BacktestTrade = {
  id: string
  side: 'long' | 'short'
  entryTime: string
  exitTime?: string | null
  pnl?: number | null
  rMultiple?: number | null
  exitReason?: string | null
}

export type EquityPoint = {
  time: string
  equity: number
  drawdown: number
}

const TERMINAL_STATUSES = new Set<BacktestRunStatus>(['done', 'failed', 'canceled'])

function parseNumeric(value: unknown): number | null {
  if (value == null) return null
  const num = typeof value === 'number' ? value : Number.parseFloat(String(value))
  return Number.isFinite(num) ? num : null
}

function normalizeRun(run: BacktestRunSummary): BacktestRun {
  return {
    id: run.id,
    status: run.status,
    strategyVersionId: run.strategyVersionId,
    config: run.config as BacktestRunConfig & { interval?: string },
    error: run.error,
    queuedAt: run.queuedAt instanceof Date ? run.queuedAt.toISOString() : String(run.queuedAt),
    finishedAt: run.finishedAt
      ? (run.finishedAt instanceof Date ? run.finishedAt.toISOString() : String(run.finishedAt))
      : null,
  }
}

function normalizeMetrics(raw: Record<string, unknown> | null | undefined): BacktestMetrics | null {
  if (!raw) return null

  return {
    tradeCount: Number(raw.tradeCount ?? 0),
    winRate: parseNumeric(raw.winRate),
    profitFactor: parseNumeric(raw.profitFactor),
    expectancy: parseNumeric(raw.expectancy),
    totalReturn: parseNumeric(raw.totalReturn),
    cagr: parseNumeric(raw.cagr),
    maxDrawdown: parseNumeric(raw.maxDrawdown),
    sharpe: parseNumeric(raw.sharpe),
    sortino: parseNumeric(raw.sortino),
    avgWin: parseNumeric(raw.avgWin),
    avgLoss: parseNumeric(raw.avgLoss),
    exposurePct: parseNumeric(raw.exposurePct),
    longestWinStreak: raw.longestWinStreak != null ? Number(raw.longestWinStreak) : null,
    longestLossStreak: raw.longestLossStreak != null ? Number(raw.longestLossStreak) : null,
    regimeBreakdown: (raw.regimeBreakdown as Record<string, unknown>) ?? {},
    qualityWarnings: Array.isArray(raw.qualityWarnings) ? raw.qualityWarnings as string[] : [],
  }
}

function normalizeTrade(raw: Record<string, unknown>): BacktestTrade {
  return {
    id: String(raw.id),
    side: raw.side as 'long' | 'short',
    entryTime: raw.entryTime instanceof Date
      ? raw.entryTime.toISOString()
      : String(raw.entryTime),
    exitTime: raw.exitTime
      ? (raw.exitTime instanceof Date ? raw.exitTime.toISOString() : String(raw.exitTime))
      : null,
    pnl: parseNumeric(raw.pnl),
    rMultiple: parseNumeric(raw.rMultiple),
    exitReason: raw.exitReason != null ? String(raw.exitReason) : null,
  }
}

function normalizeEquityPoint(raw: Record<string, unknown>): EquityPoint {
  return {
    time: raw.time instanceof Date ? raw.time.toISOString() : String(raw.time),
    equity: parseNumeric(raw.equity) ?? 0,
    drawdown: parseNumeric(raw.drawdown) ?? 0,
  }
}

const DEFAULT_CAPITAL = 100_000
const DEFAULT_LOOKBACK_MS = 365 * 24 * 60 * 60 * 1000

export const useBacktestStore = defineStore('backtest', () => {
  const activeRun = ref<BacktestRun | null>(null)
  const progress = ref<BacktestProgress | null>(null)
  const metrics = ref<BacktestMetrics | null>(null)
  const trades = ref<BacktestTrade[]>([])
  const equity = ref<EquityPoint[]>([])
  const loading = ref(false)
  const submitting = ref(false)
  const researchLoading = ref(false)
  const walkForwardResult = ref<WalkForwardResult | null>(null)
  const monteCarloResult = ref<MonteCarloResult | null>(null)
  const error = ref<string | null>(null)

  let unsubscribeProgress: (() => void) | null = null
  let pollTimer: ReturnType<typeof setInterval> | undefined

  const { connect, subscribe } = useLiveChannel()

  const isRunning = computed(() => {
    const status = activeRun.value?.status
    return status === 'queued' || status === 'running'
  })

  const isComplete = computed(() => activeRun.value?.status === 'done')

  function resetReport() {
    metrics.value = null
    trades.value = []
    equity.value = []
    walkForwardResult.value = null
    monteCarloResult.value = null
  }

  function stopTracking() {
    unsubscribeProgress?.()
    unsubscribeProgress = null
    if (pollTimer) {
      clearInterval(pollTimer)
      pollTimer = undefined
    }
  }

  function applyProgressPayload(payload: unknown) {
    const data = payload as Partial<BacktestProgress>
    if (typeof data.pct !== 'number' || !data.stage) return
    progress.value = {
      pct: Math.min(100, Math.max(0, data.pct)),
      stage: data.stage,
      eta: data.eta,
    }
  }

  async function fetchRun(runId: string) {
    const data = await $fetch<{
      run: BacktestRunSummary
      metrics?: Record<string, unknown> | null
    }>(`/api/backtests/${runId}`)

    activeRun.value = normalizeRun(data.run)
    if (data.metrics) {
      metrics.value = normalizeMetrics(data.metrics)
    }

    return activeRun.value
  }

  async function submitBacktest(
    strategyVersionId: string,
    symbolId: string,
    interval: '1m' | '5m' | '15m' | '1h' | '4h' | '1d' | '1w',
  ) {
    submitting.value = true
    error.value = null
    resetReport()
    stopTracking()

    const to = new Date()
    const from = new Date(to.getTime() - DEFAULT_LOOKBACK_MS)

    try {
      const data = await $fetch<{ runId: string }>('/api/backtests', {
        method: 'POST',
        body: {
          strategyVersionId,
          symbolIds: [symbolId],
          dateRange: {
            from: from.toISOString(),
            to: to.toISOString(),
          },
          capital: DEFAULT_CAPITAL,
          interval,
        },
      })

      activeRun.value = {
        id: data.runId,
        status: 'queued',
        strategyVersionId,
        error: null,
        queuedAt: new Date().toISOString(),
        finishedAt: null,
      }
      progress.value = { pct: 0, stage: 'queued' }
      pollRun(data.runId)
      return activeRun.value
    }
    catch (err: unknown) {
      error.value = err instanceof Error ? err.message : 'Failed to start backtest'
      throw err
    }
    finally {
      submitting.value = false
    }
  }

  function pollRun(runId: string) {
    stopTracking()
    progress.value = progress.value ?? { pct: 0, stage: 'loading' }

    connect()
    unsubscribeProgress = subscribe(`backtest.${runId}.progress`, applyProgressPayload)

    const pollStatus = async () => {
      try {
        const run = await fetchRun(runId)
        if (TERMINAL_STATUSES.has(run.status)) {
          stopTracking()
          if (run.status === 'done') {
            progress.value = { pct: 100, stage: 'done' }
            await loadReport(runId)
          }
          else if (run.status === 'failed') {
            progress.value = { pct: 100, stage: 'failed' }
            error.value = run.error ?? 'Backtest failed'
          }
        }
      }
      catch (err: unknown) {
        error.value = err instanceof Error ? err.message : 'Failed to poll backtest status'
      }
    }

    pollStatus()
    pollTimer = setInterval(pollStatus, 2000)
  }

  async function loadReport(runId: string) {
    loading.value = true
    error.value = null

    try {
      const [runData, tradesData, equityData] = await Promise.all([
        $fetch<{ run: BacktestRunSummary, metrics?: Record<string, unknown> | null }>(
          `/api/backtests/${runId}`,
        ),
        $fetch<{ trades: Array<Record<string, unknown>> }>(`/api/backtests/${runId}/trades`),
        $fetch<{ points: Array<Record<string, unknown>> }>(`/api/backtests/${runId}/equity`),
      ])

      activeRun.value = normalizeRun(runData.run)
      metrics.value = normalizeMetrics(runData.metrics)
      trades.value = tradesData.trades.map(normalizeTrade)
      equity.value = equityData.points.map(normalizeEquityPoint)
    }
    catch (err: unknown) {
      error.value = err instanceof Error ? err.message : 'Failed to load backtest report'
      throw err
    }
    finally {
      loading.value = false
    }
  }

  async function initializeRun(runId: string) {
    error.value = null

    try {
      const run = await fetchRun(runId)

      if (run.status === 'done') {
        stopTracking()
        if (!metrics.value || !equity.value.length) {
          await loadReport(runId)
        }
      }
      else if (run.status === 'queued' || run.status === 'running') {
        pollRun(runId)
      }
      else if (run.status === 'failed') {
        error.value = run.error ?? 'Backtest failed'
      }
    }
    catch (err: unknown) {
      error.value = err instanceof Error ? err.message : 'Failed to load backtest'
    }
  }

  async function runWalkForward(runId: string, foldCount = 4) {
    researchLoading.value = true
    error.value = null

    try {
      walkForwardResult.value = await $fetch<WalkForwardResult>('/api/backtests/walk-forward', {
        method: 'POST',
        body: { baseRunId: runId, foldCount },
      })
      return walkForwardResult.value
    }
    catch (err: unknown) {
      error.value = err instanceof Error ? err.message : 'Walk-forward analysis failed'
      throw err
    }
    finally {
      researchLoading.value = false
    }
  }

  async function runMonteCarlo(runId: string, iterations = 1000) {
    researchLoading.value = true
    error.value = null

    try {
      monteCarloResult.value = await $fetch<MonteCarloResult>(`/api/backtests/${runId}/monte-carlo`, {
        method: 'POST',
        body: { iterations },
      })
      return monteCarloResult.value
    }
    catch (err: unknown) {
      error.value = err instanceof Error ? err.message : 'Monte Carlo simulation failed'
      throw err
    }
    finally {
      researchLoading.value = false
    }
  }

  function clearActiveRun() {
    stopTracking()
    activeRun.value = null
    progress.value = null
    resetReport()
    error.value = null
  }

  return {
    activeRun,
    progress,
    metrics,
    trades,
    equity,
    loading,
    submitting,
    researchLoading,
    walkForwardResult,
    monteCarloResult,
    error,
    isRunning,
    isComplete,
    submitBacktest,
    pollRun,
    loadReport,
    initializeRun,
    runWalkForward,
    runMonteCarlo,
    clearActiveRun,
    stopTracking,
  }
})
