import { createRequire } from 'node:module'
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
  ProviderStatus,
  QualityFlag,
  QuoteEvent,
  SymbolKey,
  SymbolResult,
} from '../../../shared/types/market'
import { createMockProvider } from './mock-provider'

const require = createRequire(import.meta.url)

type TvSearchResult = {
  id: string
  exchange: string
  symbol: string
  description: string
  type: string
}

type TvPeriod = {
  time: number
  open: number
  close: number
  max: number
  min: number
  volume: number
}

const INTERVAL_TO_TV: Record<CandleInterval, string> = {
  '1m': '1',
  '5m': '5',
  '15m': '15',
  '1h': '60',
  '4h': '240',
  '1d': 'D',
  '1w': 'W',
}

const TV_TYPE_TO_ASSET: Record<string, AssetClass> = {
  stock: 'stock',
  crypto: 'crypto',
  forex: 'forex',
  futures: 'futures',
  index: 'index',
  cfd: 'forex',
  fund: 'stock',
  dr: 'stock',
}

function mapAssetClass(type: string): AssetClass {
  return TV_TYPE_TO_ASSET[type] ?? 'stock'
}

function toSymbolKey(result: TvSearchResult): SymbolKey {
  return {
    provider: 'tradingview',
    exchange: result.exchange,
    ticker: result.symbol,
    assetClass: mapAssetClass(result.type),
  }
}

function toMarketId(key: SymbolKey): string {
  return `${key.exchange.toUpperCase()}:${key.ticker}`
}

function mapPeriods(
  periods: TvPeriod[],
  symbolId: string,
  interval: CandleInterval,
): Candle[] {
  const now = new Date().toISOString()
  return periods
    .map((period) => ({
      symbolId,
      interval,
      time: new Date(period.time * 1000).toISOString(),
      open: period.open,
      high: period.max,
      low: period.min,
      close: period.close,
      volume: period.volume,
      source: 'tradingview',
      ingestionTime: now,
      qualityFlags: [] as QualityFlag[],
    }))
    .sort((a, b) => a.time.localeCompare(b.time))
}

type TvChart = {
  periods: TvPeriod[]
  setMarket: (id: string, opts: { timeframe: string, range?: number }) => void
  onUpdate: (cb: () => void) => void
  onError: (cb: (...args: unknown[]) => void) => void
  delete: () => void
}

type TvQuoteSession = {
  Market: new (symbol: string, session?: string) => {
    onData: (cb: (data: TvQuoteData) => void) => void
    close: () => void
  }
  delete: () => void
}

type TvQuoteData = {
  bid?: number
  ask?: number
  lp?: number
  volume?: number
}

type TvClient = {
  Session: {
    Chart: new () => TvChart
    Quote: new (options?: { fields?: 'all' | 'price' }) => TvQuoteSession
  }
  end: () => void
}

async function loadTradingView() {
  return require('@mathieuc/tradingview') as {
    searchMarketV3: (
      search: string,
      filter?: string,
      offset?: number,
    ) => Promise<TvSearchResult[]>
    Client: new (options?: { token?: string, signature?: string }) => TvClient
  }
}

export class TradingViewAdapter implements MarketDataProvider {
  private fallback = createMockProvider()
  private lastStatus: ProviderStatus = 'healthy'
  private lastError?: string
  private chartClient: TvClient | null = null
  private chartSession: TvChart | null = null

  private async ensureChartSession(): Promise<{ client: TvClient, chart: TvChart }> {
    if (this.chartClient && this.chartSession) {
      return { client: this.chartClient, chart: this.chartSession }
    }

    const TradingView = await loadTradingView()
    const client = new TradingView.Client()
    const chart = new client.Session.Chart()
    this.chartClient = client
    this.chartSession = chart
    return { client, chart }
  }

  private releaseChartSession() {
    this.chartSession?.delete()
    this.chartClient?.end()
    this.chartSession = null
    this.chartClient = null
  }

  async searchSymbols(query: string, assetClass?: AssetClass): Promise<SymbolResult[]> {
    try {
      const TradingView = await loadTradingView()
      const filter = assetClass === 'forex' ? 'forex' : assetClass === 'crypto' ? 'crypto' : ''
      const results = await TradingView.searchMarketV3(query, filter)
      this.lastStatus = 'healthy'
      return results.map((result) => {
        const key = toSymbolKey(result)
        return {
          ...key,
          label: result.symbol,
          description: result.description,
        }
      })
    }
    catch (error) {
      this.lastStatus = 'unavailable'
      this.lastError = error instanceof Error ? error.message : 'TradingView search failed'
      return this.fallback.searchSymbols(query, assetClass)
    }
  }

  async getHistoricalCandles(req: CandleRequest): Promise<CandleSeries> {
    const symbolId = `${req.symbol.provider}:${req.symbol.exchange}:${req.symbol.ticker}`
    try {
      const TradingView = await loadTradingView()
      const client = new TradingView.Client()
      const timeframe = INTERVAL_TO_TV[req.interval]
      const marketId = toMarketId(req.symbol)

      const periods = await new Promise<TvPeriod[]>((resolve, reject) => {
        const chart = new client.Session.Chart()
        const timeout = setTimeout(() => {
          chart.delete()
          client.end()
          reject(new Error('TradingView candle fetch timeout'))
        }, 20_000)

        chart.onError((...args) => {
          clearTimeout(timeout)
          chart.delete()
          client.end()
          reject(new Error(args.map(String).join(' ')))
        })

        chart.onUpdate(() => {
          if (chart.periods.length > 0) {
            clearTimeout(timeout)
            const data = [...chart.periods]
            chart.delete()
            client.end()
            resolve(data)
          }
        })

        chart.setMarket(marketId, { timeframe, range: 500 })
      })

      const candles = mapPeriods(periods, symbolId, req.interval)
      const from = new Date(req.from).getTime()
      const to = new Date(req.to).getTime()
      const filtered = candles.filter((candle) => {
        const ts = new Date(candle.time).getTime()
        return ts >= from && ts <= to
      })

      this.lastStatus = 'healthy'
      return {
        symbolId,
        interval: req.interval,
        candles: filtered.length > 0 ? filtered : candles.slice(-300),
      }
    }
    catch (error) {
      this.lastStatus = 'delayed'
      this.lastError = error instanceof Error ? error.message : 'TradingView candles failed'
      return this.fallback.getHistoricalCandles(req)
    }
  }

  async *subscribeQuotes(symbols: SymbolKey[]): AsyncIterable<QuoteEvent> {
    if (symbols.length === 0) {
      yield* this.fallback.subscribeQuotes(symbols)
      return
    }

    try {
      const { client } = await this.ensureChartSession()
      const quoteSession = new client.Session.Quote({ fields: 'price' })
      const markets: Array<InstanceType<TvQuoteSession['Market']>> = []
      const queue: QuoteEvent[] = []
      let notify: (() => void) | null = null

      const wake = () => {
        notify?.()
        notify = null
      }

      for (const symbol of symbols) {
        const marketId = toMarketId(symbol)
        const market = new quoteSession.Market(marketId)
        const symbolId = `${symbol.provider}:${symbol.exchange}:${symbol.ticker}`

        market.onData((data: TvQuoteData) => {
          queue.push({
            symbolId,
            time: new Date().toISOString(),
            bid: data.bid,
            ask: data.ask,
            last: data.lp,
            volumeDay: data.volume,
          })
          wake()
        })

        markets.push(market)
      }

      this.lastStatus = 'healthy'

      try {
        while (true) {
          if (queue.length > 0) {
            yield queue.shift()!
            continue
          }

          await Promise.race([
            new Promise<void>((resolve) => {
              notify = resolve
            }),
            new Promise<void>(resolve => setTimeout(resolve, 5_000)),
          ])
        }
      }
      finally {
        for (const market of markets) {
          market.close()
        }
        quoteSession.delete()
      }
    }
    catch (error) {
      this.lastStatus = 'delayed'
      this.lastError = error instanceof Error ? error.message : 'TradingView quotes failed'
      yield* this.fallback.subscribeQuotes(symbols)
    }
  }

  async *subscribeCandles(req: LiveCandleRequest): AsyncIterable<CandleEvent> {
    yield* this.fallback.subscribeCandles(req)
  }

  async getIndicatorValues(req: IndicatorRequest): Promise<IndicatorSeries> {
    return this.fallback.getIndicatorValues(req)
  }

  async healthCheck(): Promise<ProviderHealth> {
    try {
      const TradingView = await loadTradingView()
      const started = Date.now()
      await TradingView.searchMarketV3('AAPL')
      this.lastStatus = 'healthy'
      this.lastError = undefined
      return {
        provider: 'tradingview',
        status: 'healthy',
        latencyMs: Date.now() - started,
        lastEventAt: new Date().toISOString(),
        message: 'TradingView search reachable',
      }
    }
    catch (error) {
      this.lastStatus = 'unavailable'
      this.lastError = error instanceof Error ? error.message : 'TradingView unavailable'
      return {
        provider: 'tradingview',
        status: 'unavailable',
        lastEventAt: new Date().toISOString(),
        message: this.lastError,
      }
    }
  }

  get cachedStatus(): ProviderStatus {
    return this.lastStatus
  }
}

export function createTradingViewAdapter(): MarketDataProvider {
  return new TradingViewAdapter()
}
