import { and, eq } from 'drizzle-orm'
import { v7 as uuidv7 } from 'uuid'
import type { AssetClass, CandleInterval, ProviderStatus } from '../../../shared/types/market'
import { candles, providers, symbols } from '../../../db/schema'
import { useDb } from '../../utils/db'
import { useRedis } from '../../utils/redis'
import { createMarketDataProvider } from './index'

const SEARCH_TTL_SECONDS = 300
const CANDLE_TTL_SECONDS = 60

export type SymbolRecord = {
  id: string
  providerId: string
  exchange: string
  ticker: string
  assetClass: string
  currency: string | null
  label: string
  description?: string
}

function cacheKey(parts: string[]) {
  return parts.join(':')
}

export async function searchSymbols(
  query: string,
  assetClass?: AssetClass,
): Promise<SymbolRecord[]> {
  const normalized = query.trim().toLowerCase()
  if (!normalized) return []

  const redisKey = cacheKey(['symbol', 'search', normalized, assetClass ?? 'all'])

  try {
    const redis = useRedis()
    const cached = await redis.get(redisKey)
    if (cached) {
      return JSON.parse(cached) as SymbolRecord[]
    }
  }
  catch {
    // Redis optional in dev
  }

  const provider = createMarketDataProvider()
  const results = await provider.searchSymbols(query, assetClass)
  const db = useDb()
  const records: SymbolRecord[] = []

  for (const result of results) {
    const providerId = result.provider
    const [existing] = await db
      .select()
      .from(symbols)
      .where(
        and(
          eq(symbols.providerId, providerId),
          eq(symbols.exchange, result.exchange),
          eq(symbols.ticker, result.ticker),
        ),
      )
      .limit(1)

    let record = existing

    if (!record) {
      const [inserted] = await db
        .insert(symbols)
        .values({
          id: uuidv7(),
          providerId,
          exchange: result.exchange,
          ticker: result.ticker,
          assetClass: result.assetClass,
          currency: result.currency ?? null,
          meta: { description: result.description ?? result.label },
        })
        .onConflictDoNothing()
        .returning()

      record = inserted
    }

    if (!record) {
      const [fetched] = await db
        .select()
        .from(symbols)
        .where(eq(symbols.ticker, result.ticker))
        .limit(1)
      record = fetched
    }

    if (record) {
      records.push({
        id: record.id,
        providerId: record.providerId,
        exchange: record.exchange,
        ticker: record.ticker,
        assetClass: record.assetClass,
        currency: record.currency,
        label: result.label,
        description: result.description,
      })
    }
  }

  try {
    const redis = useRedis()
    await redis.setex(redisKey, SEARCH_TTL_SECONDS, JSON.stringify(records))
  }
  catch {
    // ignore cache write failures
  }

  return records
}

export async function getSymbolById(id: string): Promise<SymbolRecord | null> {
  const db = useDb()
  const [record] = await db.select().from(symbols).where(eq(symbols.id, id)).limit(1)
  if (!record) return null

  const meta = record.meta as { description?: string }
  return {
    id: record.id,
    providerId: record.providerId,
    exchange: record.exchange,
    ticker: record.ticker,
    assetClass: record.assetClass,
    currency: record.currency,
    label: record.ticker,
    description: meta.description,
  }
}

export async function getCandles(input: {
  symbolId: string
  interval: CandleInterval
  from: string
  to: string
}) {
  const symbol = await getSymbolById(input.symbolId)
  if (!symbol) {
    throw createError({ statusCode: 404, statusMessage: 'Symbol not found' })
  }

  const redisKey = cacheKey([
    'candles',
    input.symbolId,
    input.interval,
    input.from,
    input.to,
  ])

  try {
    const redis = useRedis()
    const cached = await redis.get(redisKey)
    if (cached) {
      return JSON.parse(cached)
    }
  }
  catch {
    // continue without cache
  }

  const provider = createMarketDataProvider()
  const series = await provider.getHistoricalCandles({
    symbol: {
      provider: symbol.providerId as 'tradingview',
      exchange: symbol.exchange,
      ticker: symbol.ticker,
      assetClass: symbol.assetClass as AssetClass,
      currency: symbol.currency ?? undefined,
    },
    interval: input.interval,
    from: input.from,
    to: input.to,
  })

  const payload = {
    symbolId: input.symbolId,
    interval: input.interval,
    candles: series.candles.map((candle) => ({
      ...candle,
      symbolId: input.symbolId,
    })),
  }

  // Persist fetched candles to DB so historical data accumulates over time.
  // Conflicts on PK (symbol_id, interval, time) are silently ignored.
  try {
    if (payload.candles.length > 0) {
      const db = useDb()
      await db
        .insert(candles)
        .values(
          payload.candles.map((c) => ({
            symbolId: input.symbolId,
            interval: input.interval,
            time: new Date(c.time as string),
            open: c.open,
            high: c.high,
            low: c.low,
            close: c.close,
            volume: c.volume ?? null,
            source: symbol.providerId,
            qualityFlags: [] as string[],
          })),
        )
        .onConflictDoNothing()
    }
  }
  catch {
    // Persistence is best-effort; never block candle delivery
  }

  try {
    const redis = useRedis()
    await redis.setex(redisKey, CANDLE_TTL_SECONDS, JSON.stringify(payload))
    await redis.set(
      cacheKey(['candle', 'latest', input.symbolId, input.interval]),
      JSON.stringify(payload.candles.at(-1) ?? null),
    )
  }
  catch {
    // ignore
  }

  return payload
}

export async function getProviderStatuses(): Promise<
  Array<{ id: string, label: string, status: ProviderStatus, message?: string }>
> {
  const db = useDb()
  const provider = createMarketDataProvider()
  const health = await provider.healthCheck()

  const status = health.status
  await db
    .insert(providers)
    .values({ id: health.provider, label: 'TradingView', status })
    .onConflictDoUpdate({
      target: providers.id,
      set: { status },
    })

  return [
    {
      id: health.provider,
      label: 'TradingView',
      status: health.status,
      message: health.message,
    },
  ]
}

export async function publishCandleEvent(
  symbolId: string,
  interval: CandleInterval,
  candle: unknown,
) {
  const channel = `market.candle.${symbolId}.${interval}`
  try {
    const redis = useRedis()
    await redis.publish(channel, JSON.stringify(candle))
    await redis.set(
      cacheKey(['candle', 'latest', symbolId, interval]),
      JSON.stringify(candle),
    )
  }
  catch {
    // ignore publish failures
  }
}
