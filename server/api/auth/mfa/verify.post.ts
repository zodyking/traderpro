import { mfaVerifySchema } from '#shared/schemas/auth'
import { queueAuthEmail, notifyLogin } from '../../../domains/email/service'
import { verifyUserTotpCode } from '../../../domains/identity/mfa'
import {
  getActiveUserById,
  requireMfaPending,
  toSessionUser,
} from '../../../utils/auth'

export default defineEventHandler(async (event) => {
  const userId = await requireMfaPending(event)
  const body = mfaVerifySchema.parse(await readBody(event))

  const valid = await verifyUserTotpCode(userId, body.code)
  if (!valid) {
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

  queueAuthEmail(() => notifyLogin({
    id: user.id,
    email: user.email,
    displayName: user.displayName,
  }, { ip: getRequestIP(event, { xForwardedFor: true }) }))

  return { user: toSessionUser(user) }
})
