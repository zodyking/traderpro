export type AssetClass = 'stock' | 'crypto' | 'forex' | 'futures' | 'index' | 'option'

export type ProviderSlug = 'tradingview' | 'broker' | 'polygon' | 'csv'

export type CandleInterval = '1m' | '5m' | '15m' | '1h' | '4h' | '1d' | '1w'

export type QualityFlag = 'gap_before' | 'late' | 'corrected' | 'duplicate' | 'suspect'

export type ProviderStatus = 'healthy' | 'delayed' | 'gapped' | 'untrusted' | 'unavailable'

export type SymbolKey = {
  provider: ProviderSlug
  exchange: string
  ticker: string
  assetClass: AssetClass
  currency?: string
}

export type Candle = {
  symbolId: string
  interval: CandleInterval
  time: string
  open: number
  high: number
  low: number
  close: number
  volume?: number
  source: string
  ingestionTime: string
  qualityFlags: QualityFlag[]
}

export type QuoteEvent = {
  symbolId: string
  time: string
  bid?: number
  ask?: number
  last?: number
  volumeDay?: number
}

export type CandleEvent = {
  symbolId: string
  interval: CandleInterval
  candle: Candle
  forming: boolean
}

export type SymbolResult = SymbolKey & {
  label: string
  description?: string
  /** TradingView market id, e.g. NASDAQ:AAPL */
  tvMarketId?: string
}

export type CandleRequest = {
  symbol: SymbolKey
  interval: CandleInterval
  from: string
  to: string
  /** Resolved TradingView market id when known (from symbol search/meta). */
  tvMarketId?: string
}

export type CandleSeries = {
  symbolId: string
  interval: CandleInterval
  candles: Candle[]
}

export type LiveCandleRequest = {
  symbolId: string
  interval: CandleInterval
  symbol?: SymbolKey
  tvMarketId?: string
}

export type IndicatorRequest = {
  symbolId: string
  interval: CandleInterval
  indicator: string
  params?: Record<string, number>
  from: string
  to: string
}

export type IndicatorPoint = {
  time: string
  value: number | Record<string, number>
}

export type IndicatorSeries = {
  symbolId: string
  indicator: string
  points: IndicatorPoint[]
}

export type ProviderHealth = {
  provider: ProviderSlug
  status: ProviderStatus
  latencyMs?: number
  lastEventAt?: string
  errorRate?: number
  reconnectCount?: number
  message?: string
}

export interface MarketDataProvider {
  searchSymbols(query: string, assetClass?: AssetClass): Promise<SymbolResult[]>
  getHistoricalCandles(req: CandleRequest): Promise<CandleSeries>
  subscribeQuotes(symbols: SymbolKey[]): AsyncIterable<QuoteEvent>
  subscribeCandles(req: LiveCandleRequest): AsyncIterable<CandleEvent>
  getIndicatorValues(req: IndicatorRequest): Promise<IndicatorSeries>
  healthCheck(): Promise<ProviderHealth>
}
