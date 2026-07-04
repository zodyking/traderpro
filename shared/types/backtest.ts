import type { BacktestRunConfig } from '../../db/schema/backtest'

export type BacktestRunStatus = 'queued' | 'running' | 'done' | 'failed' | 'canceled'

export type BacktestStage =
  | 'queued'
  | 'loading'
  | 'fetching_data'
  | 'simulating'
  | 'computing_metrics'
  | 'persisting'
  | 'metrics'
  | 'saving'
  | 'done'
  | 'failed'

export type BacktestProgressEvent = {
  pct: number
  stage: BacktestStage
  eta?: number
}

/** @deprecated use BacktestProgressEvent */
export type BacktestProgress = BacktestProgressEvent

export type BacktestRunSummary = {
  id: string
  status: BacktestRunStatus
  strategyVersionId?: string
  config: BacktestRunConfig
  error: string | null
  queuedAt: Date
  finishedAt: Date | null
}

export type BacktestMetricsSummary = {
  tradeCount: number
  winRate: number | null
  profitFactor: number | null
  expectancy: number | null
  totalReturn: number | null
  cagr: number | null
  maxDrawdown: number | null
  sharpe: number | null
  sortino: number | null
  avgWin: number | null
  avgLoss: number | null
  exposurePct: number | null
  longestWinStreak: number | null
  longestLossStreak: number | null
  regimeBreakdown: Record<string, unknown>
  qualityWarnings: string[]
}

export type BacktestRunResponse = {
  run: BacktestRunSummary
  metrics?: BacktestMetricsSummary
}

export type MetricTrade = {
  pnl: number
  entryTime: Date
  exitTime: Date
}

export type SimulatedTrade = {
  symbolId: string
  side: 'long'
  entryTime: Date
  entryPrice: number
  exitTime?: Date
  exitPrice?: number
  qty: number
  pnl?: number
  rMultiple?: number
  exitReason?: 'signal' | 'stop_loss' | 'trailing_stop' | 'take_profit' | 'end_of_data'
  signalSnapshot?: Record<string, unknown>
}

export type EquityPoint = {
  time: Date
  equity: number
  drawdown: number
}

export type SimulationResult = {
  trades: SimulatedTrade[]
  equityPoints: EquityPoint[]
  finalEquity: number
}

export type BacktestResultSummary = {
  tradeCount: number
  winRate: number | null
  profitFactor: number | null
  expectancy: number | null
  totalReturn: number | null
  cagr: number | null
  maxDrawdown: number | null
  sharpe: number | null
  sortino: number | null
  avgWin: number | null
  avgLoss: number | null
  exposurePct: number | null
  longestWinStreak: number
  longestLossStreak: number
  qualityWarnings: string[]
}
