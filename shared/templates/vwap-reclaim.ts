import type { RiskModel, RuleAst } from '../types/strategy'

export const VWAP_RECLAIM_NAME = 'VWAP Reclaim'

export function createVwapReclaimRules(): RuleAst {
  return {
    signals: [
      {
        id: 'sig-filter-session',
        name: 'Regular Session',
        kind: 'filter',
        logic: 'all',
        conditions: [
          {
            type: 'time_window',
            session: { session: 'regular' },
          },
        ],
      },
      {
        id: 'sig-entry-long',
        name: 'VWAP Reclaim',
        kind: 'entry_long',
        logic: 'all',
        conditions: [
          {
            type: 'price_level',
            field: 'close',
            op: 'gt',
            ref: { type: 'vwap' },
          },
          {
            type: 'indicator_compare',
            left: { indicator: 'rsi', params: { period: 14 } },
            op: 'gt',
            right: 45,
          },
        ],
      },
      {
        id: 'sig-exit',
        name: 'VWAP Break',
        kind: 'exit',
        logic: 'any',
        conditions: [
          {
            type: 'price_level',
            field: 'close',
            op: 'lt',
            ref: { type: 'vwap' },
          },
        ],
      },
    ],
  }
}

export function createVwapReclaimRiskModel(): RiskModel {
  return {
    stopLoss: { type: 'atr', value: 1 },
    takeProfit: { type: 'r_multiple', value: 2 },
    sizingMethod: 'risk_per_trade',
    maxRiskPerTrade: 1,
  }
}
