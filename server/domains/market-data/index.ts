import type { MarketDataProvider } from '../../../shared/types/market'
import { createMockProvider } from './mock-provider'

export type MarketDataProviderKind = 'mock' | 'tradingview'

export function createMarketDataProvider(
  kind?: MarketDataProviderKind,
): MarketDataProvider {
  const resolved =
    kind ??
    (process.env.NODE_ENV === 'production' ? 'tradingview' : 'mock')

  switch (resolved) {
    case 'mock':
      return createMockProvider()
    case 'tradingview':
      // TradingView provider will be wired in a later phase.
      return createMockProvider()
    default:
      return createMockProvider()
  }
}

export { createMockProvider, MockMarketDataProvider } from './mock-provider'
