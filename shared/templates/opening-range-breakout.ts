import type { RiskModel, RuleAst } from '../types/strategy'

export const OPENING_RANGE_BREAKOUT_NAME = 'Opening Range Breakout'

export function createOpeningRangeBreakoutRules(): RuleAst {
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
        name: 'Range Breakout',
        kind: 'entry_long',
        logic: 'all',
        conditions: [
          {
            type: 'price_level',
            field: 'close',
            op: 'gt',
            ref: { type: 'session_high' },
          },
          {
            type: 'indicator_compare',
            left: { indicator: 'volume_avg', params: { period: 1 } },
            op: 'gt',
            right: { indicator: 'volume_avg', params: { period: 20 } },
          },
        ],
      },
      {
        id: 'sig-exit',
        name: 'Range Breakdown',
        kind: 'exit',
        logic: 'any',
        conditions: [
          {
            type: 'price_level',
            field: 'close',
            op: 'lt',
            ref: { type: 'session_high' },
          },
        ],
      },
    ],
  }
}

export function createOpeningRangeBreakoutRiskModel(): RiskModel {
  return {
    stopLoss: { type: 'atr', value: 1.5 },
    takeProfit: { type: 'r_multiple', value: 3 },
    sizingMethod: 'risk_per_trade',
    maxRiskPerTrade: 1,
    maxDailyLoss: 2,
  }
}
