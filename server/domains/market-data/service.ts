import { and, asc, eq, gte, lte } from 'drizzle-orm'
import { v7 as uuidv7 } from 'uuid'
import type { AssetClass, CandleInterval, ProviderStatus, QuoteEvent } from '../../../shared/types/market'
import { candles, providers, quoteSnapshots, symbols } from '../../../db/schema'
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

export function isCandleCoverageSufficient(
  rows: Array<{ time: Date }>,
  from: string,
  to: string,
): boolean {
  if (rows.length === 0) return false

  const fromMs = new Date(from).getTime()
  const toMs = new Date(to).getTime()
  const rangeMs = Math.max(0, toMs - fromMs)
  if (rangeMs === 0) return rows.length > 0

  const firstMs = rows[0]!.time.getTime()
  const lastMs = rows[rows.length - 1]!.time.getTime()
  const edgeSlack = Math.min(rangeMs * 0.05, 24 * 60 * 60 * 1000)

  return firstMs <= fromMs + edgeSlack
    && lastMs >= toMs - edgeSlack
    && (lastMs - firstMs) >= rangeMs * 0.9
}

async function fetchCandlesFromDb(input: {
  symbolId: string
  interval: CandleInterval
  from: string
  to: string
}) {
  const db = useDb()
  return db
    .select()
    .from(candles)
    .where(
      and(
        eq(candles.symbolId, input.symbolId),
        eq(candles.interval, input.interval),
        gte(candles.time, new Date(input.from)),
        lte(candles.time, new Date(input.to)),
      ),
    )
    .orderBy(asc(candles.time))
}

function buildCandlePayload(
  symbolId: string,
  interval: CandleInterval,
  rows: Array<{
    time: Date
    open: number
    high: number
    low: number
    close: number
    volume: number | null
  }>,
) {
  return {
    symbolId,
    interval,
    candles: rows.map((row) => ({
      symbolId,
      interval,
      time: row.time.toISOString(),
      open: row.open,
      high: row.high,
      low: row.low,
      close: row.close,
      volume: row.volume ?? undefined,
    })),
  }
}

async function cacheCandlePayload(
  redisKey: string,
  symbolId: string,
  interval: CandleInterval,
  payload: ReturnType<typeof buildCandlePayload>,
) {
  try {
    const redis = useRedis()
    await redis.setex(redisKey, CANDLE_TTL_SECONDS, JSON.stringify(payload))
    await redis.set(
      cacheKey(['candle', 'latest', symbolId, interval]),
      JSON.stringify(payload.candles.at(-1) ?? null),
    )
  }
  catch {
    // ignore
  }
}

export async function persistQuoteSnapshot(quote: QuoteEvent): Promise<void> {
  if (!quote.symbolId || !quote.time) return

  try {
    const db = useDb()
    await db
      .insert(quoteSnapshots)
      .values({
        symbolId: quote.symbolId,
        time: new Date(quote.time),
        bid: quote.bid ?? null,
        ask: quote.ask ?? null,
        last: quote.last ?? null,
        volumeDay: quote.volumeDay ?? null,
      })
      .onConflictDoNothing()
  }
  catch {
    // Persistence is best-effort
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

  try {
    const dbRows = await fetchCandlesFromDb(input)
    if (isCandleCoverageSufficient(dbRows, input.from, input.to)) {
      const payload = buildCandlePayload(input.symbolId, input.interval, dbRows)
      await cacheCandlePayload(redisKey, input.symbolId, input.interval, payload)
      return payload
    }
  }
  catch {
    // DB read optional in some environments
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

  const payload = buildCandlePayload(
    input.symbolId,
    input.interval,
    series.candles.map((candle) => ({
      time: new Date(candle.time),
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close,
      volume: candle.volume ?? null,
    })),
  )

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

  await cacheCandlePayload(redisKey, input.symbolId, input.interval, payload)

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
