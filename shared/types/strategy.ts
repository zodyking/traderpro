export type Op = 'gt' | 'gte' | 'lt' | 'lte' | 'eq_within'

export type IndicatorRef = {
  indicator: 'ema' | 'sma' | 'rsi' | 'vwap' | 'atr' | 'macd' | 'bbands' | 'volume_avg'
  params: Record<string, number>
  timeframe?: string
  offset?: number
}

export type LevelRef = IndicatorRef | { type: 'price' | 'vwap' | 'session_high' | 'session_low' }

export type SessionRef = {
  session: 'regular' | 'extended' | 'premarket' | 'afterhours' | '24h'
  timezone?: string
}

export type Condition =
  | { type: 'indicator_compare'; left: IndicatorRef; op: Op; right: IndicatorRef | number }
  | { type: 'price_level'; field: 'open' | 'high' | 'low' | 'close'; op: Op; ref: LevelRef }
  | { type: 'crossover'; a: IndicatorRef; b: IndicatorRef; direction: 'above' | 'below' }
  | { type: 'candle_pattern'; pattern: 'engulfing' | 'pin_bar' | 'inside_bar' | 'doji' }
  | { type: 'time_window'; session: SessionRef }

export type Signal = {
  id: string
  name: string
  kind: 'entry_long' | 'entry_short' | 'exit' | 'filter' | 'warning'
  logic: 'all' | 'any'
  conditions: Condition[]
}

export type RuleAst = {
  signals: Signal[]
}

export type RiskModel = {
  stopLoss?: { type: 'fixed' | 'percent' | 'atr'; value: number }
  takeProfit?: { type: 'fixed' | 'percent' | 'r_multiple'; value: number }
  trailingStop?: { type: 'percent' | 'atr'; value: number }
  sizingMethod?: 'fixed_shares' | 'fixed_dollars' | 'percent_equity' | 'risk_per_trade'
  maxRiskPerTrade?: number
  maxDailyLoss?: number
}

export type MarketFilters = {
  regime?: string[]
  session?: SessionRef
  volatility?: { min?: number; max?: number }
  spread?: { max?: number }
  volume?: { min?: number }
}

export type ExecutionAssumptions = {
  slippage?: { type: 'fixed' | 'percent' | 'atr'; value: number }
  fees?: { type: 'per_share' | 'percent' | 'fixed'; value: number }
  fillModel?: 'next_open' | 'close_confirmation' | 'intrabar'
}

export type CompiledCondition = {
  hash: string
  root: Condition
}
