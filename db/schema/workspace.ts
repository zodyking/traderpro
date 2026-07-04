import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import type { CompiledCondition } from '../../shared/types/strategy'
import { users } from './identity'
import { symbols } from './market'
import { strategyVersions } from './strategy'

export const workspaces = pgTable('workspaces', {
  id: uuid('id').primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  layout: jsonb('layout').notNull().default({}),
  isDefault: boolean('is_default').notNull().default(false),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
})

export const watchlists = pgTable('watchlists', {
  id: uuid('id').primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  sort: integer('sort').notNull().default(0),
})

export const watchlistSymbols = pgTable(
  'watchlist_symbols',
  {
    watchlistId: uuid('watchlist_id')
      .notNull()
      .references(() => watchlists.id, { onDelete: 'cascade' }),
    symbolId: uuid('symbol_id')
      .notNull()
      .references(() => symbols.id),
    sort: integer('sort').notNull().default(0),
  },
  (table) => [primaryKey({ columns: [table.watchlistId, table.symbolId] })],
)

export const alerts = pgTable(
  'alerts',
  {
    id: uuid('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    symbolId: uuid('symbol_id').references(() => symbols.id),
    strategyVersionId: uuid('strategy_version_id').references(() => strategyVersions.id, {
      onDelete: 'set null',
    }),
    condition: jsonb('condition').$type<CompiledCondition>().notNull(),
    conditionHash: text('condition_hash').notNull(),
    active: boolean('active').notNull().default(true),
    lastFiredAt: timestamp('last_fired_at', { withTimezone: true, mode: 'date' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (table) => [index('idx_alerts_active').on(table.active, table.symbolId, table.conditionHash)],
)

export const learningProgress = pgTable('learning_progress', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  completedLessons: text('completed_lessons').array().notNull().default(sql`'{}'`),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
})
