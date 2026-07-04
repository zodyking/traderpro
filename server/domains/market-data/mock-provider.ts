import type {
  AssetClass,
  Candle,
  CandleEvent,
  CandleInterval,
  CandleRequest,
  CandleSeries,
  IndicatorRequest,
  IndicatorSeries,
  LiveCandleRequest,
  MarketDataProvider,
  ProviderHealth,
  QuoteEvent,
  SymbolKey,
  SymbolResult,
} from '../../../shared/types/market'

const SAMPLE_SYMBOLS: SymbolKey[] = [
  {
    provider: 'csv',
    exchange: 'NASDAQ',
    ticker: 'AAPL',
    assetClass: 'stock',
    currency: 'USD',
  },
  {
    provider: 'csv',
    exchange: 'CRYPTO',
    ticker: 'BTCUSD',
    assetClass: 'crypto',
    currency: 'USD',
  },
  {
    provider: 'csv',
    exchange: 'FX',
    ticker: 'EURUSD',
    assetClass: 'forex',
    currency: 'USD',
  },
]

function symbolId(key: SymbolKey): string {
  return `${key.provider}:${key.exchange}:${key.ticker}`
}

function generateSampleCandles(
  symbol: SymbolKey,
  interval: CandleInterval,
  from: string,
  to: string,
): Candle[] {
  const candles: Candle[] = []
  const intervalMs = 60_000
  let price = 100 + Math.random() * 50
  let ts = new Date(from).getTime()
  const end = new Date(to).getTime()
  const id = symbolId(symbol)
  const now = new Date().toISOString()

  while (ts <= end) {
    const open = price
    const change = (Math.random() - 0.5) * 2
    const close = Math.max(0.01, open + change)
    const high = Math.max(open, close) + Math.random()
    const low = Math.min(open, close) - Math.random()

    candles.push({
      symbolId: id,
      interval,
      time: new Date(ts).toISOString(),
      open,
      high,
      low,
      close,
      volume: Math.floor(1000 + Math.random() * 9000),
      source: 'mock',
      ingestionTime: now,
      qualityFlags: [],
    })

    price = close
    ts += intervalMs
  }

  return candles
}

function generateSampleQuote(key: SymbolKey): QuoteEvent {
  const last = 100 + Math.random() * 50
  const spread = 0.01 + Math.random() * 0.05

  return {
    symbolId: symbolId(key),
    time: new Date().toISOString(),
    bid: last - spread / 2,
    ask: last + spread / 2,
    last,
    volumeDay: Math.floor(1000 + Math.random() * 9000),
  }
}

export class MockMarketDataProvider implements MarketDataProvider {
  async searchSymbols(query: string, assetClass?: AssetClass): Promise<SymbolResult[]> {
    const normalized = query.trim().toLowerCase()
    return SAMPLE_SYMBOLS.filter((symbol) => {
      const matchesQuery =
        !normalized
        || symbol.ticker.toLowerCase().includes(normalized)
        || symbol.exchange.toLowerCase().includes(normalized)
      const matchesAsset = !assetClass || symbol.assetClass === assetClass
      return matchesQuery && matchesAsset
    }).map((symbol) => ({
      ...symbol,
      label: symbol.ticker,
      description: `${symbol.exchange} · ${symbol.assetClass}`,
    }))
  }

  async getHistoricalCandles(req: CandleRequest): Promise<CandleSeries> {
    const id = symbolId(req.symbol)
    return {
      symbolId: id,
      interval: req.interval,
      candles: generateSampleCandles(req.symbol, req.interval, req.from, req.to),
    }
  }

  async *subscribeQuotes(symbols: SymbolKey[]): AsyncIterable<QuoteEvent> {
    const targets = symbols.length > 0 ? symbols : SAMPLE_SYMBOLS
    while (true) {
      const symbol = targets[Math.floor(Math.random() * targets.length)]!
      yield generateSampleQuote(symbol)
      await new Promise((resolve) => setTimeout(resolve, 1000))
    }
  }

  async *subscribeCandles(req: LiveCandleRequest): AsyncIterable<CandleEvent> {
    const symbol = SAMPLE_SYMBOLS.find((item) => symbolId(item) === req.symbolId) ?? SAMPLE_SYMBOLS[0]!
    while (true) {
      const [candle] = generateSampleCandles(
        symbol,
        req.interval,
        new Date(Date.now() - 60_000).toISOString(),
        new Date().toISOString(),
      )
      yield {
        symbolId: req.symbolId,
        interval: req.interval,
        candle: candle!,
        forming: true,
      }
      await new Promise((resolve) => setTimeout(resolve, 1000))
    }
  }

  async getIndicatorValues(req: IndicatorRequest): Promise<IndicatorSeries> {
    const points = Array.from({ length: 20 }, (_, index) => ({
      time: new Date(Date.now() - (20 - index) * 60_000).toISOString(),
      value: 50 + Math.random() * 10,
    }))

    return {
      symbolId: req.symbolId,
      indicator: req.indicator,
      points,
    }
  }

  async healthCheck(): Promise<ProviderHealth> {
    return {
      provider: 'csv',
      status: 'healthy',
      latencyMs: 1,
      lastEventAt: new Date().toISOString(),
      message: 'Mock provider serving sample data',
    }
  }
}

export function createMockProvider(): MarketDataProvider {
  return new MockMarketDataProvider()
}
