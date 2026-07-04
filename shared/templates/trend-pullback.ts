import type { RiskModel, RuleAst } from '../types/strategy'

export const TREND_PULLBACK_NAME = 'Trend Pullback'

export function createTrendPullbackRules(): RuleAst {
  return {
    signals: [
      {
        id: 'sig-filter-trend',
        name: 'Trend Filter',
        kind: 'filter',
        logic: 'all',
        conditions: [
          {
            type: 'price_level',
            field: 'close',
            op: 'gt',
            ref: { indicator: 'ema', params: { period: 50 } },
          },
        ],
      },
      {
        id: 'sig-entry-long',
        name: 'Pullback Entry',
        kind: 'entry_long',
        logic: 'all',
        conditions: [
          {
            type: 'indicator_compare',
            left: { indicator: 'rsi', params: { period: 14 } },
            op: 'lt',
            right: 30,
          },
          {
            type: 'price_level',
            field: 'close',
            op: 'gt',
            ref: { indicator: 'ema', params: { period: 20 } },
          },
        ],
      },
      {
        id: 'sig-exit',
        name: 'Exit Signal',
        kind: 'exit',
        logic: 'any',
        conditions: [
          {
            type: 'indicator_compare',
            left: { indicator: 'rsi', params: { period: 14 } },
            op: 'gt',
            right: 70,
          },
          {
            type: 'price_level',
            field: 'close',
            op: 'lt',
            ref: { indicator: 'ema', params: { period: 20 } },
          },
        ],
      },
    ],
  }
}

export function createTrendPullbackRiskModel(): RiskModel {
  return {
    stopLoss: { type: 'atr', value: 1.5 },
    takeProfit: { type: 'r_multiple', value: 2 },
    sizingMethod: 'risk_per_trade',
    maxRiskPerTrade: 1,
  }
}
