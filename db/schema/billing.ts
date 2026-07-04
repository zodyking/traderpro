import {
  date,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core'
import { users } from './identity'

export type PlanLimits = {
  backtestsPerMonth?: number
  scannerSymbols?: number
  aiCredits?: number
  brokerAccounts?: number
  savedStrategies?: number
  savedWorkspaces?: number
  exports?: number
  apiCalls?: number
}

export const plans = pgTable('plans', {
  id: text('id').primaryKey(),
  label: text('label').notNull(),
  limits: jsonb('limits').$type<PlanLimits>().notNull(),
})

export const subscriptions = pgTable(
  'subscriptions',
  {
    id: uuid('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    planId: text('plan_id')
      .notNull()
      .references(() => plans.id),
    status: text('status').notNull().default('active'),
    providerRef: text('provider_ref'),
    periodEnd: timestamp('period_end', { withTimezone: true, mode: 'date' }),
  },
  (table) => [unique('subscriptions_user_id_unique').on(table.userId)],
)

export const usageCounters = pgTable(
  'usage_counters',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    metric: text('metric').notNull(),
    period: date('period').notNull(),
    used: integer('used').notNull().default(0),
  },
  (table) => [primaryKey({ columns: [table.userId, table.metric, table.period] })],
)
