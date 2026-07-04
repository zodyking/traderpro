import type { RiskModel, RuleAst } from '../types/strategy'

export const MEAN_REVERSION_NAME = 'Mean Reversion'

export function createMeanReversionRules(): RuleAst {
  return {
    signals: [
      {
        id: 'sig-entry-long',
        name: 'Oversold Entry',
        kind: 'entry_long',
        logic: 'all',
        conditions: [
          {
            type: 'indicator_compare',
            left: { indicator: 'rsi', params: { period: 14 } },
            op: 'lt',
            right: 25,
          },
          {
            type: 'price_level',
            field: 'close',
            op: 'gt',
            ref: { indicator: 'sma', params: { period: 50 } },
          },
        ],
      },
      {
        id: 'sig-exit',
        name: 'Mean Reached',
        kind: 'exit',
        logic: 'any',
        conditions: [
          {
            type: 'indicator_compare',
            left: { indicator: 'rsi', params: { period: 14 } },
            op: 'gt',
            right: 55,
          },
          {
            type: 'price_level',
            field: 'close',
            op: 'lt',
            ref: { indicator: 'sma', params: { period: 50 } },
          },
        ],
      },
    ],
  }
}

export function createMeanReversionRiskModel(): RiskModel {
  return {
    stopLoss: { type: 'percent', value: 2 },
    takeProfit: { type: 'r_multiple', value: 1.5 },
    sizingMethod: 'risk_per_trade',
    maxRiskPerTrade: 0.75,
  }
}
