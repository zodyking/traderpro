import type { RiskModel, RuleAst } from '../types/strategy'

export const BREAKOUT_RETEST_NAME = 'Breakout Retest'

export function createBreakoutRetestRules(): RuleAst {
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
        name: 'Breakout Entry',
        kind: 'entry_long',
        logic: 'all',
        conditions: [
          {
            type: 'price_level',
            field: 'close',
            op: 'gt',
            ref: { indicator: 'sma', params: { period: 20 } },
          },
          {
            type: 'indicator_compare',
            left: { indicator: 'rsi', params: { period: 14 } },
            op: 'gt',
            right: 50,
          },
        ],
      },
      {
        id: 'sig-exit',
        name: 'Exit on Breakdown',
        kind: 'exit',
        logic: 'any',
        conditions: [
          {
            type: 'price_level',
            field: 'close',
            op: 'lt',
            ref: { indicator: 'sma', params: { period: 20 } },
          },
        ],
      },
    ],
  }
}

export function createBreakoutRetestRiskModel(): RiskModel {
  return {
    stopLoss: { type: 'atr', value: 2 },
    takeProfit: { type: 'r_multiple', value: 2.5 },
    sizingMethod: 'risk_per_trade',
    maxRiskPerTrade: 1,
  }
}
