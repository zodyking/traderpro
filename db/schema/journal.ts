import { sql } from 'drizzle-orm'
import {
  check,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core'
import { users } from './identity'
import { symbols } from './market'
import { strategyVersions } from './strategy'

export type JournalPlanned = {
  entry?: number
  stop?: number
  target?: number
  size?: number
  thesis?: string
}

export type JournalActual = {
  entry?: number
  exit?: number
  size?: number
}

export const journalEntries = pgTable(
  'journal_entries',
  {
    id: uuid('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    symbolId: uuid('symbol_id').references(() => symbols.id),
    strategyVersionId: uuid('strategy_version_id').references(() => strategyVersions.id),
    executionIds: uuid('execution_ids').array().notNull().default(sql`'{}'`),
    side: text('side'),
    setupTag: text('setup_tag'),
    planned: jsonb('planned').$type<JournalPlanned>().notNull().default({}),
    actual: jsonb('actual').$type<JournalActual>().notNull().default({}),
    emotion: text('emotion'),
    mistakes: text('mistakes').array().notNull().default(sql`'{}'`),
    note: text('note'),
    screenshots: text('screenshots').array().notNull().default(sql`'{}'`),
    openedAt: timestamp('opened_at', { withTimezone: true, mode: 'date' }),
    closedAt: timestamp('closed_at', { withTimezone: true, mode: 'date' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (table) => [
    check('journal_entries_side_check', sql`${table.side} IS NULL OR ${table.side} IN ('long', 'short')`),
    index('idx_journal').on(table.userId, table.symbolId, table.setupTag, table.openedAt),
  ],
)
