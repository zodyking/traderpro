import { describe, expect, it } from 'vitest'
import {
  resolveTradingViewMarketId,
  toTradingViewMarketId,
} from '../server/domains/market-data/tradingview-adapter'
import { resolveMarketDataProviderKind } from '../server/domains/market-data'

describe('toTradingViewMarketId', () => {
  it('builds exchange:ticker market ids', () => {
    expect(
      toTradingViewMarketId({
        provider: 'tradingview',
        exchange: 'nasdaq',
        ticker: 'aapl',
        assetClass: 'stock',
      }),
    ).toBe('NASDAQ:AAPL')
  })
})

describe('resolveTradingViewMarketId', () => {
  it('returns a provided tv market id without searching', async () => {
    const id = await resolveTradingViewMarketId(
      {
        provider: 'tradingview',
        exchange: 'NASDAQ',
        ticker: 'AAPL',
        assetClass: 'stock',
      },
      'NASDAQ:AAPL',
    )

    expect(id).toBe('NASDAQ:AAPL')
  })
})

describe('resolveMarketDataProviderKind', () => {
  it('defaults to tradingview outside tests', () => {
    const previous = process.env.MARKET_DATA_PROVIDER
    delete process.env.MARKET_DATA_PROVIDER
    process.env.NODE_ENV = 'development'

    expect(resolveMarketDataProviderKind()).toBe('tradingview')

    if (previous) process.env.MARKET_DATA_PROVIDER = previous
  })

  it('honors explicit mock env', () => {
    const previous = process.env.MARKET_DATA_PROVIDER
    process.env.MARKET_DATA_PROVIDER = 'mock'
    process.env.NODE_ENV = 'development'

    expect(resolveMarketDataProviderKind()).toBe('mock')

    if (previous) process.env.MARKET_DATA_PROVIDER = previous
    else delete process.env.MARKET_DATA_PROVIDER
  })
})
