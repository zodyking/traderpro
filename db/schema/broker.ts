import { sql } from 'drizzle-orm'
import {
  check,
  doublePrecision,
  index,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core'
import { bytea } from './pg-types'
import { users } from './identity'
import { symbols } from './market'

export const brokerConnections = pgTable(
  'broker_connections',
  {
    id: uuid('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    broker: text('broker').notNull(),
    label: text('label').notNull(),
    credsEnc: bytea('creds_enc'),
    status: text('status').notNull().default('connected'),
    lastSyncAt: timestamp('last_sync_at', { withTimezone: true, mode: 'date' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (table) => [
    check(
      'broker_connections_status_check',
      sql`${table.status} IN ('connected', 'syncing', 'degraded', 'expired', 'revoked')`,
    ),
  ],
)

export const brokerAccounts = pgTable('broker_accounts', {
  id: uuid('id').primaryKey(),
  connectionId: uuid('connection_id')
    .notNull()
    .references(() => brokerConnections.id, { onDelete: 'cascade' }),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  accountRef: text('account_ref').notNull(),
  currency: text('currency').notNull().default('USD'),
  equity: numeric('equity', { precision: 16, scale: 4 }),
  cash: numeric('cash', { precision: 16, scale: 4 }),
  buyingPower: numeric('buying_power', { precision: 16, scale: 4 }),
  snapshotAt: timestamp('snapshot_at', { withTimezone: true, mode: 'date' }),
})

export const executions = pgTable(
  'executions',
  {
    id: uuid('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    accountId: uuid('account_id')
      .notNull()
      .references(() => brokerAccounts.id, { onDelete: 'cascade' }),
    symbolId: uuid('symbol_id').references(() => symbols.id),
    rawSymbol: text('raw_symbol').notNull(),
    side: text('side').notNull(),
    qty: doublePrecision('qty').notNull(),
    price: doublePrecision('price').notNull(),
    fees: numeric('fees', { precision: 12, scale: 4 }).notNull().default('0'),
    executedAt: timestamp('executed_at', { withTimezone: true, mode: 'date' }).notNull(),
    orderRef: text('order_ref'),
    sourcePayload: jsonb('source_payload').notNull().default({}),
  },
  (table) => [
    check('executions_side_check', sql`${table.side} IN ('buy', 'sell')`),
    index('idx_exec_user_time').on(table.userId, table.accountId, table.executedAt),
    index('idx_exec_symbol').on(table.userId, table.symbolId, table.executedAt),
  ],
)

export const transfers = pgTable(
  'transfers',
  {
    id: uuid('id').primaryKey(),
    accountId: uuid('account_id')
      .notNull()
      .references(() => brokerAccounts.id, { onDelete: 'cascade' }),
    kind: text('kind').notNull(),
    amount: numeric('amount', { precision: 16, scale: 4 }).notNull(),
    occurredAt: timestamp('occurred_at', { withTimezone: true, mode: 'date' }).notNull(),
  },
  (table) => [
    check(
      'transfers_kind_check',
      sql`${table.kind} IN ('deposit', 'withdrawal', 'fee', 'dividend')`,
    ),
  ],
)

export const brokerSyncJobs = pgTable('broker_sync_jobs', {
  id: uuid('id').primaryKey(),
  connectionId: uuid('connection_id')
    .notNull()
    .references(() => brokerConnections.id, { onDelete: 'cascade' }),
  status: text('status').notNull(),
  rangeFrom: timestamp('range_from', { withTimezone: true, mode: 'date' }),
  rangeTo: timestamp('range_to', { withTimezone: true, mode: 'date' }),
  stats: jsonb('stats').notNull().default({}),
  error: text('error'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
})
