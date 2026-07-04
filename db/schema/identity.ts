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
import { bytea, citext, inet } from './pg-types'

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey(),
    email: citext('email').notNull().unique(),
    passwordHash: text('password_hash'),
    displayName: text('display_name').notNull(),
    experience: text('experience').notNull().default('novice'),
    uiMode: text('ui_mode').notNull().default('novice'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'date' }),
  },
  (table) => [
    check(
      'users_experience_check',
      sql`${table.experience} IN ('novice', 'developing', 'advanced', 'system')`,
    ),
    check('users_ui_mode_check', sql`${table.uiMode} IN ('novice', 'pro')`),
  ],
)

export const sessions = pgTable('sessions', {
  id: uuid('id').primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').notNull().unique(),
  deviceLabel: text('device_label'),
  ip: inet('ip'),
  expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
})

export const mfaMethods = pgTable(
  'mfa_methods',
  {
    id: uuid('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    kind: text('kind').notNull(),
    secretEnc: bytea('secret_enc').notNull(),
    verifiedAt: timestamp('verified_at', { withTimezone: true, mode: 'date' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (table) => [
    check('mfa_methods_kind_check', sql`${table.kind} IN ('totp', 'webauthn', 'recovery')`),
  ],
)

export const apiKeys = pgTable('api_keys', {
  id: uuid('id').primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  keyHash: text('key_hash').notNull().unique(),
  scopes: text('scopes').array().notNull().default(sql`'{}'`),
  lastUsedAt: timestamp('last_used_at', { withTimezone: true, mode: 'date' }),
  revokedAt: timestamp('revoked_at', { withTimezone: true, mode: 'date' }),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
})

export const auditLogs = pgTable(
  'audit_logs',
  {
    id: uuid('id').primaryKey(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    action: text('action').notNull(),
    target: text('target'),
    meta: jsonb('meta').notNull().default({}),
    ip: inet('ip'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (table) => [index('idx_audit_user_time').on(table.userId, table.createdAt)],
)
