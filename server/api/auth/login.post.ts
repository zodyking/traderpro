import { loginSchema } from '#shared/schemas/auth'
import { queueAuthEmail, notifyLogin } from '../../domains/email/service'
import { findUserByEmail, toSessionUser, userHasVerifiedMfa } from '../../utils/auth'
import { verifyPassword } from '../../utils/password'

export default defineEventHandler(async (event) => {
  const body = loginSchema.parse(await readBody(event))
  const user = await findUserByEmail(body.email)

  if (!user?.passwordHash) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Invalid email or password',
    })
  }

  const valid = await verifyPassword(body.password, user.passwordHash)

  if (!valid) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Invalid email or password',
    })
  }

  const mfaRequired = await userHasVerifiedMfa(user.id)

  if (mfaRequired) {
    await setUserSession(event, {
      mfaPending: true,
      pendingUserId: user.id,
    })

    return { mfaRequired: true as const }
  }

  await setUserSession(event, {
    user: toSessionUser(user),
  })

  queueAuthEmail(() => notifyLogin({
    id: user.id,
    email: user.email,
    displayName: user.displayName,
  }, { ip: getRequestIP(event, { xForwardedFor: true }) }))

  return { user: toSessionUser(user) }
})
