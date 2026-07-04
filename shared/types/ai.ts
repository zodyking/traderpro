import type { ExecutionAssumptions, RiskModel, RuleAst } from './strategy'

export type RiskLimits = {
  maxRiskPerTrade?: number
  maxDailyLoss?: number
  maxOpenPositions?: number
}

export type BacktestMetrics = {
  tradeCount: number
  winRate?: number
  profitFactor?: number
  expectancy?: number
  totalReturn?: number
  cagr?: number
  maxDrawdown?: number
  sharpe?: number
  sortino?: number
}

export type EquitySummary = {
  startEquity: number
  endEquity: number
  peakEquity: number
  troughEquity: number
}

export type Distribution = {
  wins: number
  losses: number
  avgWin?: number
  avgLoss?: number
}

export type RegimeStats = Record<string, { trades: number; expectancy?: number; winRate?: number }>

export type TradeSummary = {
  symbol: string
  side: 'long' | 'short'
  pnl?: number
  executedAt: string
}

export type ExposureSnapshot = {
  openPositions: number
  grossExposure: number
  netExposure: number
}

export type DrawdownState = {
  currentDrawdown: number
  maxDrawdown: number
  daysInDrawdown?: number
}

export interface AIReviewPacket {
  userProfile: { experienceLevel: string; assetClasses: string[]; riskLimits: RiskLimits }
  strategy?: {
    name: string
    version: number
    rules: RuleAst
    riskModel: RiskModel
    assumptions: ExecutionAssumptions
  }
  testResults?: {
    metrics: BacktestMetrics
    equitySummary: EquitySummary
    tradeDistribution: Distribution
    regimeBreakdown: RegimeStats
  }
  brokerContext?: {
    recentTrades: TradeSummary[]
    exposure: ExposureSnapshot
    drawdownState: DrawdownState
  }
  tradeEntry?: {
    id: string
    side?: string | null
    setupTag?: string | null
    planned?: Record<string, unknown>
    actual?: Record<string, unknown>
    emotion?: string | null
    mistakes?: string[]
    note?: string | null
    openedAt?: string
    closedAt?: string
  }
  marketContext?: {
    symbol: string
    exchange?: string
  }
  lessonContext?: {
    id: string
    title: string
    stage: string
    source: string
    duration: string
  }
  dataQuality: { source: string; gaps: number; warnings: string[] }
  requestedReviewType: 'strategy' | 'trade' | 'risk' | 'lesson' | 'market' | 'assistant'
}

export type AIReviewResult = {
  observations?: string[]
  risks?: string[]
  strengths?: string[]
  actions?: string[]
}
