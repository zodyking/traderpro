import { sql } from 'drizzle-orm'
import {
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core'
import { users } from './identity'

export type ScanRunConfig = {
  symbolIds?: string[]
  interval: string
}

export type ScanRunResult = {
  matches: Array<{
    alertId: string
    symbolId: string
    conditionHash: string
    firedAt: string
  }>
  scannedAlerts: number
  scannedSymbols: number
}

export const scanRuns = pgTable(
  'scan_runs',
  {
    id: uuid('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    status: text('status').notNull().default('queued'),
    config: jsonb('config').$type<ScanRunConfig>().notNull(),
    result: jsonb('result').$type<ScanRunResult>(),
    error: text('error'),
    queuedAt: timestamp('queued_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    finishedAt: timestamp('finished_at', { withTimezone: true, mode: 'date' }),
  },
  (table) => [
    check(
      'scan_runs_status_check',
      sql`${table.status} IN ('queued', 'running', 'done', 'failed', 'canceled')`,
    ),
    index('idx_scan_user').on(table.userId, table.queuedAt),
  ],
)
