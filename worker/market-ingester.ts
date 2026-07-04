import type { Job } from 'bullmq'
import type { CandleInterval } from '../shared/types/market'
import { watchlistSymbols } from '../db/schema'
import { getCandles } from '../server/domains/market-data/service'
import { analyzeCandleQuality } from '../server/domains/market-data/quality'
import { useDb } from '../server/utils/db'

const DEFAULT_INTERVALS: CandleInterval[] = ['1h', '1d']
const BACKFILL_DAYS = 7

export async function collectWatchlistSymbolIds(): Promise<string[]> {
  const db = useDb()
  const rows = await db
    .selectDistinct({ symbolId: watchlistSymbols.symbolId })
    .from(watchlistSymbols)

  return rows.map((row) => row.symbolId)
}

export async function runMarketIngest(intervals: CandleInterval[] = DEFAULT_INTERVALS) {
  const symbolIds = await collectWatchlistSymbolIds()
  const to = new Date().toISOString()
  const from = new Date(Date.now() - BACKFILL_DAYS * 24 * 60 * 60 * 1000).toISOString()

  let ingested = 0
  for (const symbolId of symbolIds) {
    for (const interval of intervals) {
      try {
        const series = await getCandles({ symbolId, interval, from, to })
        ingested++
        if (series.candles.length > 0) {
          await analyzeCandleQuality({
            symbolId,
            interval,
            candles: series.candles,
          })
        }
      }
      catch (error) {
        console.warn(`[market-ingest] failed for ${symbolId} ${interval}`, error)
      }
    }
  }

  return {
    symbolCount: symbolIds.length,
    intervalCount: intervals.length,
    ingested,
  }
}

export async function processMarketIngestJob(job: Job) {
  const result = await runMarketIngest()
  console.log(`[market-ingest] job ${job.id ?? 'unknown'} complete`, result)
  return result
}
