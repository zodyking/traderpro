import { randomBytes } from 'node:crypto'
import { and, desc, eq, isNull } from 'drizzle-orm'
import { hash } from '@node-rs/argon2'
import { v7 as uuidv7 } from 'uuid'
import { apiKeys } from '../../../db/schema'
import type { ApiKeyCreateInput, ApiKeyCreated, ApiKeyRow } from '../../../shared/schemas/api-keys'
import { useDb } from '../../utils/db'

const KEY_PREFIX = 'axk_'

const ARGON2_OPTIONS = {
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
}

function generateApiKeyValue(): string {
  return `${KEY_PREFIX}${randomBytes(32).toString('base64url')}`
}

function formatApiKeyRow(row: typeof apiKeys.$inferSelect): ApiKeyRow {
  return {
    id: row.id,
    name: row.name,
    scopes: row.scopes,
    lastUsedAt: row.lastUsedAt?.toISOString() ?? null,
    revokedAt: row.revokedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  }
}

export async function createApiKey(userId: string, input: ApiKeyCreateInput): Promise<ApiKeyCreated> {
  const db = useDb()
  const id = uuidv7()
  const key = generateApiKeyValue()
  const keyHash = await hash(key, ARGON2_OPTIONS)

  const [row] = await db
    .insert(apiKeys)
    .values({
      id,
      userId,
      name: input.name,
      keyHash,
      scopes: input.scopes ?? [],
    })
    .returning()

  return {
    ...formatApiKeyRow(row!),
    key,
  }
}

export async function listApiKeys(userId: string): Promise<ApiKeyRow[]> {
  const db = useDb()
  const rows = await db
    .select()
    .from(apiKeys)
    .where(and(eq(apiKeys.userId, userId), isNull(apiKeys.revokedAt)))
    .orderBy(desc(apiKeys.createdAt))

  return rows.map(formatApiKeyRow)
}

export async function revokeApiKey(userId: string, keyId: string): Promise<void> {
  const db = useDb()
  const [row] = await db
    .select()
    .from(apiKeys)
    .where(and(eq(apiKeys.id, keyId), eq(apiKeys.userId, userId), isNull(apiKeys.revokedAt)))
    .limit(1)

  if (!row) {
    throw createError({ statusCode: 404, statusMessage: 'API key not found' })
  }

  await db
    .update(apiKeys)
    .set({ revokedAt: new Date() })
    .where(eq(apiKeys.id, keyId))
}

export async function verifyApiKey(plaintext: string, keyHash: string): Promise<boolean> {
  const { verify } = await import('@node-rs/argon2')
  return verify(keyHash, plaintext, ARGON2_OPTIONS)
}
