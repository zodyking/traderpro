import type { RiskModel, RuleAst } from '../types/strategy'

export const MOMENTUM_CONTINUATION_NAME = 'Momentum Continuation'

export function createMomentumContinuationRules(): RuleAst {
  return {
    signals: [
      {
        id: 'sig-filter-200',
        name: 'Long-term Trend',
        kind: 'filter',
        logic: 'all',
        conditions: [
          {
            type: 'price_level',
            field: 'close',
            op: 'gt',
            ref: { indicator: 'ema', params: { period: 200 } },
          },
        ],
      },
      {
        id: 'sig-entry-long',
        name: 'EMA Cross Entry',
        kind: 'entry_long',
        logic: 'all',
        conditions: [
          {
            type: 'crossover',
            a: { indicator: 'ema', params: { period: 8 } },
            b: { indicator: 'ema', params: { period: 21 } },
            direction: 'above',
          },
          {
            type: 'indicator_compare',
            left: { indicator: 'rsi', params: { period: 14 } },
            op: 'gt',
            right: 55,
          },
        ],
      },
      {
        id: 'sig-exit',
        name: 'EMA Cross Exit',
        kind: 'exit',
        logic: 'any',
        conditions: [
          {
            type: 'crossover',
            a: { indicator: 'ema', params: { period: 8 } },
            b: { indicator: 'ema', params: { period: 21 } },
            direction: 'below',
          },
        ],
      },
    ],
  }
}

export function createMomentumContinuationRiskModel(): RiskModel {
  return {
    stopLoss: { type: 'atr', value: 2 },
    takeProfit: { type: 'r_multiple', value: 3 },
    trailingStop: { type: 'atr', value: 1.5 },
    sizingMethod: 'risk_per_trade',
    maxRiskPerTrade: 1.5,
  }
}
