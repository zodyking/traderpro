import { describe, expect, it } from 'vitest'
import { createMockProvider } from '../server/domains/market-data/mock-provider'

describe('MockMarketDataProvider', () => {
  it('returns healthy provider status', async () => {
    const provider = createMockProvider()
    const health = await provider.healthCheck()

    expect(health.status).toBe('healthy')
    expect(health.provider).toBe('csv')
  })

  it('searches symbols by ticker', async () => {
    const provider = createMockProvider()
    const results = await provider.searchSymbols('AAPL')

    expect(results.length).toBeGreaterThan(0)
    expect(results[0]?.ticker).toBe('AAPL')
  })

  it('returns historical candles for a range', async () => {
    const provider = createMockProvider()
    const series = await provider.getHistoricalCandles({
      symbol: {
        provider: 'csv',
        exchange: 'NASDAQ',
        ticker: 'AAPL',
        assetClass: 'stock',
      },
      interval: '1m',
      from: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
      to: new Date().toISOString(),
    })

    expect(series.candles.length).toBeGreaterThan(0)
    expect(series.candles[0]?.open).toBeTypeOf('number')
  })
})
