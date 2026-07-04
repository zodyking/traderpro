import { createMarketDataProvider } from '../../domains/market-data'

export default defineEventHandler(async () => {
  const provider = createMarketDataProvider('mock')
  const health = await provider.healthCheck()

  return {
    providers: [health],
    active: health.provider,
  }
})
