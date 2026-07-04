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

export function createMarketDataProvider(
  kind?: MarketDataProviderKind,
): MarketDataProvider {
  const envKind = process.env.MARKET_DATA_PROVIDER as MarketDataProviderKind | undefined
  const resolved = kind ?? envKind ?? (process.env.NODE_ENV === 'test' ? 'mock' : 'tradingview')

  if (resolved === 'mock') return useMock()

  try {
    return useTradingView()
  }
  catch {
    return useMock()
  }
}

export { createMockProvider, MockMarketDataProvider } from './mock-provider'
export { createTradingViewAdapter, TradingViewAdapter } from './tradingview-adapter'
