import type { H3Event } from 'h3'
import { eq, isNull } from 'drizzle-orm'
import { v7 as uuidv7 } from 'uuid'
import { users } from '../../db/schema'
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
