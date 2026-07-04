import type { RealismConfig } from '../../../shared/schemas/backtest'
import type { BacktestResultSummary } from '../../../shared/types/backtest'
import type { CandleInterval } from '../../../shared/types/market'
import { getStrategyVersion } from '../strategy/service'
import { runInlineBacktest } from './walk-forward'

export type SweepResultRow = {
  stopLossPct: number
  metrics: BacktestResultSummary
}

export type ParameterSweepResult = {
  stopLossValues: number[]
  results: SweepResultRow[]
  best: {
    stopLossPct: number
    totalReturn: number | null
  } | null
}

export async function runParameterSweep(input: {
  userId: string
  strategyVersionId: string
  symbolIds: string[]
  dateRange: { from: string; to: string }
  capital: number
  interval: CandleInterval
  stopLossValues: number[]
  realism?: RealismConfig
}): Promise<ParameterSweepResult> {
  const version = await getStrategyVersion(input.userId, input.strategyVersionId)
  const results: SweepResultRow[] = []

  for (const stopLossPct of input.stopLossValues) {
    const metrics = await runInlineBacktest({
      userId: input.userId,
      strategyVersionId: input.strategyVersionId,
      symbolIds: input.symbolIds,
      dateRange: input.dateRange,
      capital: input.capital,
      interval: input.interval,
      realism: input.realism,
      riskModelOverride: {
        ...version.riskModel,
        stopLoss: { type: 'percent', value: stopLossPct },
      },
    })

    results.push({ stopLossPct, metrics })
  }

  const ranked = results
    .filter(row => row.metrics.totalReturn != null)
    .sort((a, b) => (b.metrics.totalReturn ?? 0) - (a.metrics.totalReturn ?? 0))

  const best = ranked[0]
    ? {
        stopLossPct: ranked[0].stopLossPct,
        totalReturn: ranked[0].metrics.totalReturn,
      }
    : null

  return {
    stopLossValues: input.stopLossValues,
    results,
    best,
  }
}
