import { loginSchema } from '#shared/schemas/auth'
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

  return { user: toSessionUser(user) }
})
