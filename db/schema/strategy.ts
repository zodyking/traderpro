import {
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core'
import type {
  ExecutionAssumptions,
  MarketFilters,
  RiskModel,
  RuleAst,
} from '../../shared/types/strategy'
import { users } from './identity'

export const strategies = pgTable('strategies', {
  id: uuid('id').primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  assetClass: text('asset_class').notNull(),
  timeframe: text('timeframe').notNull(),
  archivedAt: timestamp('archived_at', { withTimezone: true, mode: 'date' }),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
})

export const strategyVersions = pgTable(
  'strategy_versions',
  {
    id: uuid('id').primaryKey(),
    strategyId: uuid('strategy_id')
      .notNull()
      .references(() => strategies.id, { onDelete: 'cascade' }),
    version: integer('version').notNull(),
    rules: jsonb('rules').$type<RuleAst>().notNull(),
    riskModel: jsonb('risk_model').$type<RiskModel>().notNull(),
    filters: jsonb('filters').$type<MarketFilters>().notNull().default({}),
    assumptions: jsonb('assumptions').$type<ExecutionAssumptions>().notNull().default({}),
    note: text('note'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (table) => [unique('strategy_versions_strategy_id_version_unique').on(table.strategyId, table.version)],
)
