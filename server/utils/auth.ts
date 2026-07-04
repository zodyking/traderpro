import type { H3Event } from 'h3'
import { and, eq, isNotNull, isNull } from 'drizzle-orm'
import { v7 as uuidv7 } from 'uuid'
import { mfaMethods, users } from '../../db/schema'
import { getApiKeyUser } from './api-key-context'
import { useDb } from './db'

export async function requireUser(event: H3Event) {
  const session = await getUserSession(event)

  if (!session.user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
    })
  }

  return session.user
}

export async function requireUserOrApiKey(event: H3Event) {
  const session = await getUserSession(event)
  if (session.user) {
    return session.user
  }

  const apiKey = getApiKeyUser(event)
  if (apiKey) {
    const user = await getActiveUserById(apiKey.userId)
    if (user) {
      return toSessionUser(user)
    }
  }

  throw createError({
    statusCode: 401,
    statusMessage: 'Unauthorized',
  })
}

export async function findUserByEmail(email: string) {
  const db = useDb()
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, email.toLowerCase()))
    .limit(1)

  if (!user || user.deletedAt) {
    return null
  }

  return user
}

export async function createUser(input: {
  email: string
  passwordHash: string
  displayName: string
}) {
  const db = useDb()
  const id = uuidv7()

  const [user] = await db
    .insert(users)
    .values({
      id,
      email: input.email.toLowerCase(),
      passwordHash: input.passwordHash,
      displayName: input.displayName,
    })
    .returning()

  return user!
}

export function toSessionUser(user: typeof users.$inferSelect) {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    experience: user.experience as 'novice' | 'developing' | 'advanced' | 'system',
    uiMode: user.uiMode as 'novice' | 'pro',
  }
}

export async function getActiveUserById(userId: string) {
  const db = useDb()
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)

  if (!user || user.deletedAt) {
    return null
  }

  return user
}

export async function listActiveUsers() {
  const db = useDb()
  return db.select().from(users).where(isNull(users.deletedAt))
}

export async function userHasVerifiedMfa(userId: string): Promise<boolean> {
  const db = useDb()
  const [row] = await db
    .select({ id: mfaMethods.id })
    .from(mfaMethods)
    .where(and(eq(mfaMethods.userId, userId), isNotNull(mfaMethods.verifiedAt)))
    .limit(1)

  return !!row
}

export async function requireMfaPending(event: H3Event): Promise<string> {
  const session = await getUserSession(event)

  if (!session.mfaPending || !session.pendingUserId) {
    throw createError({
      statusCode: 401,
      statusMessage: 'MFA verification required',
    })
  }

  return session.pendingUserId
}
