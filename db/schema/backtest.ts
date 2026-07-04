import { sql } from 'drizzle-orm'
import {
  check,
  doublePrecision,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core'
import type { RealismConfig } from '../../shared/schemas/backtest'
import { users } from './identity'
import { symbols } from './market'
import { strategyVersions } from './strategy'

export type BacktestRunConfig = {
  symbols: string[]
  dateRange: { from: string; to: string }
  capital: number
  realism?: RealismConfig
}

export type BacktestDataSnapshot = {
  provider: string
  candleRangeHashes: Record<string, string>
  qualitySummary?: Record<string, unknown>
}

export const backtestRuns = pgTable(
  'backtest_runs',
  {
    id: uuid('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    strategyVersionId: uuid('strategy_version_id')
      .notNull()
      .references(() => strategyVersions.id),
    status: text('status').notNull().default('queued'),
    config: jsonb('config').$type<BacktestRunConfig>().notNull(),
    dataSnapshot: jsonb('data_snapshot').$type<BacktestDataSnapshot>().notNull(),
    error: text('error'),
    queuedAt: timestamp('queued_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    finishedAt: timestamp('finished_at', { withTimezone: true, mode: 'date' }),
  },
  (table) => [
    check(
      'backtest_runs_status_check',
      sql`${table.status} IN ('queued', 'running', 'done', 'failed', 'canceled')`,
    ),
    index('idx_bt_user').on(table.userId, table.strategyVersionId, table.queuedAt),
  ],
)

export const backtestMetrics = pgTable('backtest_metrics', {
  runId: uuid('run_id')
    .primaryKey()
    .references(() => backtestRuns.id, { onDelete: 'cascade' }),
  tradeCount: integer('trade_count').notNull(),
  winRate: numeric('win_rate', { precision: 6, scale: 4 }),
  profitFactor: numeric('profit_factor', { precision: 10, scale: 4 }),
  expectancy: numeric('expectancy', { precision: 14, scale: 6 }),
  totalReturn: numeric('total_return', { precision: 14, scale: 6 }),
  cagr: numeric('cagr', { precision: 10, scale: 6 }),
  maxDrawdown: numeric('max_drawdown', { precision: 10, scale: 6 }),
  sharpe: numeric('sharpe', { precision: 10, scale: 4 }),
  sortino: numeric('sortino', { precision: 10, scale: 4 }),
  avgWin: numeric('avg_win', { precision: 14, scale: 6 }),
  avgLoss: numeric('avg_loss', { precision: 14, scale: 6 }),
  exposurePct: numeric('exposure_pct', { precision: 6, scale: 4 }),
  longestWinStreak: integer('longest_win_streak'),
  longestLossStreak: integer('longest_loss_streak'),
  regimeBreakdown: jsonb('regime_breakdown').notNull().default({}),
  qualityWarnings: text('quality_warnings').array().notNull().default(sql`'{}'`),
})

export const backtestTrades = pgTable(
  'backtest_trades',
  {
    id: uuid('id').primaryKey(),
    runId: uuid('run_id')
      .notNull()
      .references(() => backtestRuns.id, { onDelete: 'cascade' }),
    symbolId: uuid('symbol_id')
      .notNull()
      .references(() => symbols.id),
    side: text('side').notNull(),
    entryTime: timestamp('entry_time', { withTimezone: true, mode: 'date' }).notNull(),
    entryPrice: doublePrecision('entry_price').notNull(),
    exitTime: timestamp('exit_time', { withTimezone: true, mode: 'date' }),
    exitPrice: doublePrecision('exit_price'),
    qty: doublePrecision('qty').notNull(),
    pnl: numeric('pnl', { precision: 14, scale: 6 }),
    rMultiple: numeric('r_multiple', { precision: 10, scale: 4 }),
    exitReason: text('exit_reason'),
    signalSnapshot: jsonb('signal_snapshot').notNull().default({}),
  },
  (table) => [
    check('backtest_trades_side_check', sql`${table.side} IN ('long', 'short')`),
    index('idx_btt_run').on(table.runId, table.entryTime),
  ],
)

export const equityPoints = pgTable(
  'equity_points',
  {
    runId: uuid('run_id')
      .notNull()
      .references(() => backtestRuns.id, { onDelete: 'cascade' }),
    time: timestamp('time', { withTimezone: true, mode: 'date' }).notNull(),
    equity: numeric('equity', { precision: 16, scale: 6 }).notNull(),
    drawdown: numeric('drawdown', { precision: 10, scale: 6 }).notNull(),
  },
  (table) => [primaryKey({ columns: [table.runId, table.time] })],
)
