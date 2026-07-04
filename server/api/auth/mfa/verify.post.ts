import { mfaVerifySchema } from '#shared/schemas/auth'
import { and, eq, isNotNull } from 'drizzle-orm'
import { mfaMethods } from '../../../../db/schema'
import {
  getActiveUserById,
  requireMfaPending,
  toSessionUser,
} from '../../../utils/auth'
import { useDb } from '../../../utils/db'

export default defineEventHandler(async (event) => {
  const userId = await requireMfaPending(event)
  const body = mfaVerifySchema.parse(await readBody(event))

  const db = useDb()
  const [method] = await db
    .select()
    .from(mfaMethods)
    .where(
      and(
        eq(mfaMethods.userId, userId),
        eq(mfaMethods.kind, 'totp'),
        isNotNull(mfaMethods.verifiedAt),
      ),
    )
    .limit(1)

  if (!method) {
    throw createError({
      statusCode: 400,
      statusMessage: 'No verified TOTP method found',
    })
  }

  // TOTP stub: accept any 6-digit code when a verified method exists.
  if (!/^\d{6}$/.test(body.code)) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Invalid verification code',
    })
  }

  const user = await getActiveUserById(userId)
  if (!user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
    })
  }

  await setUserSession(event, {
    user: toSessionUser(user),
    mfaPending: undefined,
    pendingUserId: undefined,
  })

  return { user: toSessionUser(user) }
})
