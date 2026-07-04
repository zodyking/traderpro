import { sql } from 'drizzle-orm'
import {
  check,
  doublePrecision,
  index,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core'
import type { QualityFlag } from '../../shared/types/market'

export const providers = pgTable(
  'providers',
  {
    id: text('id').primaryKey(),
    label: text('label').notNull(),
    status: text('status').notNull().default('healthy'),
  },
  (table) => [
    check(
      'providers_status_check',
      sql`${table.status} IN ('healthy', 'delayed', 'gapped', 'untrusted', 'unavailable')`,
    ),
  ],
)

export const symbols = pgTable(
  'symbols',
  {
    id: uuid('id').primaryKey(),
    providerId: text('provider_id')
      .notNull()
      .references(() => providers.id),
    exchange: text('exchange').notNull(),
    ticker: text('ticker').notNull(),
    assetClass: text('asset_class').notNull(),
    currency: text('currency'),
    meta: jsonb('meta').notNull().default({}),
  },
  (table) => [
    check(
      'symbols_asset_class_check',
      sql`${table.assetClass} IN ('stock', 'crypto', 'forex', 'futures', 'index', 'option')`,
    ),
    unique('symbols_provider_exchange_ticker_unique').on(
      table.providerId,
      table.exchange,
      table.ticker,
    ),
  ],
)

export const candles = pgTable(
  'candles',
  {
    symbolId: uuid('symbol_id')
      .notNull()
      .references(() => symbols.id),
    interval: text('interval').notNull(),
    time: timestamp('time', { withTimezone: true, mode: 'date' }).notNull(),
    open: doublePrecision('open').notNull(),
    high: doublePrecision('high').notNull(),
    low: doublePrecision('low').notNull(),
    close: doublePrecision('close').notNull(),
    volume: doublePrecision('volume'),
    source: text('source').notNull(),
    ingestedAt: timestamp('ingested_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    qualityFlags: text('quality_flags').array().notNull().default(sql`'{}'`),
  },
  (table) => [primaryKey({ columns: [table.symbolId, table.interval, table.time] })],
)

export const quoteSnapshots = pgTable(
  'quote_snapshots',
  {
    symbolId: uuid('symbol_id')
      .notNull()
      .references(() => symbols.id),
    time: timestamp('time', { withTimezone: true, mode: 'date' }).notNull(),
    bid: doublePrecision('bid'),
    ask: doublePrecision('ask'),
    last: doublePrecision('last'),
    volumeDay: doublePrecision('volume_day'),
  },
  (table) => [primaryKey({ columns: [table.symbolId, table.time] })],
)

export const dataQualityReports = pgTable(
  'data_quality_reports',
  {
    id: uuid('id').primaryKey(),
    symbolId: uuid('symbol_id')
      .notNull()
      .references(() => symbols.id),
    interval: text('interval').notNull(),
    kind: text('kind').notNull(),
    rangeFrom: timestamp('range_from', { withTimezone: true, mode: 'date' }).notNull(),
    rangeTo: timestamp('range_to', { withTimezone: true, mode: 'date' }).notNull(),
    detail: jsonb('detail').notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (table) => [index('idx_dqr_symbol').on(table.symbolId, table.interval, table.createdAt)],
)

export type CandleQualityFlags = QualityFlag[]
