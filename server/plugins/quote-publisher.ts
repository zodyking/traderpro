import type { AssetClass, QuoteEvent, SymbolKey } from '../../shared/types/market'
import { createMarketDataProvider } from '../domains/market-data'
import {
  getSymbolById,
  persistQuoteSnapshot,
  publishQuoteEvent,
} from '../domains/market-data/service'
import { logError } from '../utils/logger'
import { collectWatchlistSymbolIds } from '../../worker/market-ingester'

function symbolKeyString(key: SymbolKey): string {
  return `${key.provider}:${key.exchange}:${key.ticker}`
}

export default defineNitroPlugin((nitroApp) => {
  if (process.env.QUOTE_PUBLISHER === '0') {
    return
  }

  let aborted = false

  async function resolveWatchlistQuotes(): Promise<{
    symbolKeys: SymbolKey[]
    idByKey: Map<string, string>
  }> {
    const symbolIds = await collectWatchlistSymbolIds()
    const symbolKeys: SymbolKey[] = []
    const idByKey = new Map<string, string>()

    for (const id of symbolIds) {
      const record = await getSymbolById(id)
      if (!record) continue

      const key: SymbolKey = {
        provider: record.providerId as SymbolKey['provider'],
        exchange: record.exchange,
        ticker: record.ticker,
        assetClass: record.assetClass as AssetClass,
        currency: record.currency ?? undefined,
      }

      symbolKeys.push(key)
      idByKey.set(symbolKeyString(key), id)
    }

    return { symbolKeys, idByKey }
  }

  async function publishLoop() {
    const provider = createMarketDataProvider()

    while (!aborted) {
      try {
        const { symbolKeys, idByKey } = await resolveWatchlistQuotes()

        if (symbolKeys.length === 0) {
          await new Promise(resolve => setTimeout(resolve, 10_000))
          continue
        }

        for await (const quote of provider.subscribeQuotes(symbolKeys)) {
          if (aborted) break

          const dbSymbolId = idByKey.get(quote.symbolId) ?? quote.symbolId
          const enriched: QuoteEvent = { ...quote, symbolId: dbSymbolId }

          await publishQuoteEvent(dbSymbolId, enriched)
          await persistQuoteSnapshot(enriched)
        }
      }
      catch (error) {
        logError('quote-publisher', error)
        await new Promise(resolve => setTimeout(resolve, 5_000))
      }
    }
  }

  void publishLoop()
  console.log('[quote-publisher] streaming watchlist quotes')

  nitroApp.hooks.hook('close', () => {
    aborted = true
  })
})
