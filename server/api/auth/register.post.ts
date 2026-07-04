import { registerSchema } from '#shared/schemas/auth'
import { createUser, findUserByEmail, toSessionUser } from '../../utils/auth'
import { hashPassword } from '../../utils/password'

export default defineEventHandler(async (event) => {
  const body = registerSchema.parse(await readBody(event))
  const existing = await findUserByEmail(body.email)

  if (existing) {
    throw createError({
      statusCode: 409,
      statusMessage: 'An account with this email already exists',
    })
  }

  const passwordHash = await hashPassword(body.password)
  const user = await createUser({
    email: body.email,
    passwordHash,
    displayName: body.displayName,
  })

  await setUserSession(event, {
    user: toSessionUser(user),
  })

  setResponseStatus(event, 201)
  return { user: toSessionUser(user) }
})
