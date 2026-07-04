import { sql } from 'drizzle-orm'
import {
  check,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core'
import type { AIReviewPacket, AIReviewResult } from '../../shared/types/ai'
import { users } from './identity'

export const aiReviews = pgTable(
  'ai_reviews',
  {
    id: uuid('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    targetType: text('target_type').notNull(),
    targetId: uuid('target_id').notNull(),
    packet: jsonb('packet').$type<AIReviewPacket>().notNull(),
    result: jsonb('result').$type<AIReviewResult>(),
    model: text('model').notNull(),
    status: text('status').notNull().default('queued'),
    tokensIn: integer('tokens_in'),
    tokensOut: integer('tokens_out'),
    costUsd: numeric('cost_usd', { precision: 10, scale: 6 }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (table) => [
    check(
      'ai_reviews_target_type_check',
      sql`${table.targetType} IN ('strategy', 'trade', 'risk', 'lesson')`,
    ),
    check(
      'ai_reviews_status_check',
      sql`${table.status} IN ('queued', 'running', 'done', 'failed')`,
    ),
    index('idx_ai_target').on(table.userId, table.targetType, table.targetId, table.createdAt),
  ],
)
