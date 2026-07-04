import { publishCandleEvent } from '../domains/market-data/service'
import { resolveMarketDataProviderKind } from '../domains/market-data'

export default defineNitroPlugin((nitroApp) => {
  if (resolveMarketDataProviderKind() !== 'mock') {
    return
  }

  const timer = setInterval(async () => {
    try {
      const redis = useRedis()
      const keys = await redis.keys('candle:latest:*')

      for (const key of keys) {
        const parts = key.split(':')
        const symbolId = parts[2]
        const candleInterval = parts[3]
        if (!symbolId || !candleInterval) continue

        const raw = await redis.get(key)
        if (!raw) continue

        const candle = JSON.parse(raw) as {
          close: number
          high: number
          low: number
          open: number
          time: string
        }

        const delta = (Math.random() - 0.5) * 0.2
        const close = Math.max(0.01, candle.close + delta)
        const updated = {
          ...candle,
          close,
          high: Math.max(candle.high, close),
          low: Math.min(candle.low, close),
          time: new Date().toISOString(),
        }

        await redis.set(key, JSON.stringify(updated))
        await publishCandleEvent(symbolId, candleInterval as '1h', {
          symbolId,
          interval: candleInterval,
          candle: updated,
          forming: true,
        })
      }
    }
    catch {
      // Redis not available in some environments
    }
  }, 2000)

  nitroApp.hooks.hook('close', () => clearInterval(timer))
})
