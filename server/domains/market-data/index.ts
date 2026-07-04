import type { MarketDataProvider } from '../../../shared/types/market'
import { createMockProvider } from './mock-provider'
import { createTradingViewAdapter } from './tradingview-adapter'

export type MarketDataProviderKind = 'mock' | 'tradingview'

let tradingViewInstance: MarketDataProvider | undefined
let mockInstance: MarketDataProvider | undefined

function useMock() {
  if (!mockInstance) mockInstance = createMockProvider()
  return mockInstance
}

function useTradingView() {
  if (!tradingViewInstance) tradingViewInstance = createTradingViewAdapter()
  return tradingViewInstance
}

export function resolveMarketDataProviderKind(
  kind?: MarketDataProviderKind,
): MarketDataProviderKind {
  const envKind = process.env.MARKET_DATA_PROVIDER as MarketDataProviderKind | undefined

  if (kind) return kind
  if (envKind === 'mock' || envKind === 'tradingview') return envKind
  if (process.env.NODE_ENV === 'test') return 'mock'

  return 'tradingview'
}

export function createMarketDataProvider(
  kind?: MarketDataProviderKind,
): MarketDataProvider {
  const resolved = resolveMarketDataProviderKind(kind)

  if (resolved === 'mock') {
    if (process.env.NODE_ENV === 'production') {
      console.warn('[market-data] MARKET_DATA_PROVIDER=mock in production — charts use synthetic data. Set tradingview for live TradingView candles.')
    }
    return useMock()
  }

  console.info('[market-data] using TradingView provider (@mathieuc/tradingview)')
  return useTradingView()
}

export { createMockProvider, MockMarketDataProvider } from './mock-provider'
export { createTradingViewAdapter, TradingViewAdapter } from './tradingview-adapter'
