import { getActiveUserById, requireUser, toSessionUser } from '../utils/auth'

export default defineEventHandler(async (event) => {
  const sessionUser = await requireUser(event)
  const user = await getActiveUserById(sessionUser.id)

  if (!user) {
    await clearUserSession(event)
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
    })
  }

  return { user: toSessionUser(user) }
})
