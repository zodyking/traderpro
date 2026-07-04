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

const CANDLE_FETCH_TIMEOUT_MS = 25_000
const CANDLE_FETCH_RANGE = 500

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

export function toTradingViewMarketId(key: SymbolKey): string {
  return `${key.exchange.toUpperCase()}:${key.ticker.toUpperCase()}`
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

type TradingViewModule = {
  searchMarketV3: (
    search: string,
    filter?: string,
    offset?: number,
  ) => Promise<TvSearchResult[]>
  Client: new (options?: { token?: string, signature?: string }) => TvClient
}

async function loadTradingView(): Promise<TradingViewModule> {
  return require('@mathieuc/tradingview') as TradingViewModule
}

function pickSearchMatch(results: TvSearchResult[], key: SymbolKey): TvSearchResult | undefined {
  const ticker = key.ticker.toUpperCase()
  const exchange = key.exchange.toUpperCase()

  return results.find((result) => result.symbol.toUpperCase() === ticker
    && result.exchange.toUpperCase() === exchange)
    ?? results.find((result) => result.id.toUpperCase() === `${exchange}:${ticker}`)
    ?? results.find((result) => result.symbol.toUpperCase() === ticker)
}

export async function resolveTradingViewMarketId(
  key: SymbolKey,
  tvMarketId?: string,
): Promise<string> {
  if (tvMarketId) return tvMarketId

  const constructed = toTradingViewMarketId(key)

  try {
    const TradingView = await loadTradingView()
    const results = await TradingView.searchMarketV3(key.ticker)
    const match = pickSearchMatch(results, key)
    return match?.id ?? constructed
  }
  catch {
    return constructed
  }
}

export async function fetchTradingViewPeriods(
  marketId: string,
  interval: CandleInterval,
  range = CANDLE_FETCH_RANGE,
): Promise<TvPeriod[]> {
  const TradingView = await loadTradingView()
  const client = new TradingView.Client()
  const timeframe = INTERVAL_TO_TV[interval]

  try {
    return await new Promise<TvPeriod[]>((resolve, reject) => {
      const chart = new client.Session.Chart()
      const timeout = setTimeout(() => {
        chart.delete()
        reject(new Error('TradingView candle fetch timeout'))
      }, CANDLE_FETCH_TIMEOUT_MS)

      chart.onError((...args) => {
        clearTimeout(timeout)
        chart.delete()
        reject(new Error(args.map(String).join(' ') || 'TradingView chart error'))
      })

      chart.onUpdate(() => {
        if (chart.periods.length > 0) {
          clearTimeout(timeout)
          resolve([...chart.periods])
          chart.delete()
        }
      })

      chart.setMarket(marketId, { timeframe, range })
    })
  }
  finally {
    client.end()
  }
}

function filterCandlesByRange(candles: Candle[], from: string, to: string): Candle[] {
  const fromMs = new Date(from).getTime()
  const toMs = new Date(to).getTime()

  const filtered = candles.filter((candle) => {
    const ts = new Date(candle.time).getTime()
    return ts >= fromMs && ts <= toMs
  })

  if (filtered.length > 0) return filtered
  if (candles.length === 0) return candles
  return candles.slice(-300)
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
          tvMarketId: result.id,
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
      const marketId = await resolveTradingViewMarketId(req.symbol, req.tvMarketId)
      const periods = await fetchTradingViewPeriods(marketId, req.interval)
      const candles = mapPeriods(periods, symbolId, req.interval)
      const ranged = filterCandlesByRange(candles, req.from, req.to)

      if (ranged.length === 0) {
        throw new Error(`TradingView returned no candles for ${marketId}`)
      }

      this.lastStatus = 'healthy'
      this.lastError = undefined
      return {
        symbolId,
        interval: req.interval,
        candles: ranged,
      }
    }
    catch (error) {
      this.lastStatus = 'delayed'
      this.lastError = error instanceof Error ? error.message : 'TradingView candles failed'
      const fallback = await this.fallback.getHistoricalCandles(req)
      if (fallback.candles.length > 0) {
        return fallback
      }

      throw error instanceof Error ? error : new Error('TradingView candles failed')
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
        const marketId = await resolveTradingViewMarketId(symbol)
        const market = new quoteSession.Market(marketId)
        const resolvedSymbolId = `${symbol.provider}:${symbol.exchange}:${symbol.ticker}`

        market.onData((data: TvQuoteData) => {
          queue.push({
            symbolId: resolvedSymbolId,
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
    if (!req.symbol) {
      yield* this.fallback.subscribeCandles(req)
      return
    }

    const marketId = await resolveTradingViewMarketId(req.symbol, req.tvMarketId)
    const timeframe = INTERVAL_TO_TV[req.interval]
    let client: TvClient | null = null
    let chart: TvChart | null = null

    try {
      const TradingView = await loadTradingView()
      client = new TradingView.Client()
      chart = new client.Session.Chart()

      const queue: CandleEvent[] = []
      let notify: (() => void) | null = null
      let lastEmittedTime: string | null = null

      const wake = () => {
        notify?.()
        notify = null
      }

      chart.onError(() => {
        wake()
      })

      chart.onUpdate(() => {
        const latest = chart?.periods.at(-1)
        if (!latest) return

        const candle = mapPeriods([latest], req.symbolId, req.interval)[0]
        if (!candle || candle.time === lastEmittedTime) return

        lastEmittedTime = candle.time
        queue.push({
          symbolId: req.symbolId,
          interval: req.interval,
          candle,
          forming: true,
        })
        wake()
      })

      chart.setMarket(marketId, { timeframe, range: 5 })
      this.lastStatus = 'healthy'

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
    catch (error) {
      this.lastStatus = 'delayed'
      this.lastError = error instanceof Error ? error.message : 'TradingView live candles failed'
      yield* this.fallback.subscribeCandles(req)
    }
    finally {
      chart?.delete()
      client?.end()
    }
  }

  async getIndicatorValues(req: IndicatorRequest): Promise<IndicatorSeries> {
    return this.fallback.getIndicatorValues(req)
  }

  async healthCheck(): Promise<ProviderHealth> {
    try {
      const TradingView = await loadTradingView()
      const started = Date.now()
      await TradingView.searchMarketV3('AAPL')
      const periods = await fetchTradingViewPeriods('NASDAQ:AAPL', '1h', 5)
      if (periods.length === 0) {
        throw new Error('TradingView candle stream unavailable')
      }

      this.lastStatus = 'healthy'
      this.lastError = undefined
      return {
        provider: 'tradingview',
        status: 'healthy',
        latencyMs: Date.now() - started,
        lastEventAt: new Date().toISOString(),
        message: 'TradingView search and candles reachable',
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
