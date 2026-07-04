import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { requireUser, toSessionUser } from '../utils/auth'
import { useDb, schema } from '../utils/db'

const patchMeSchema = z.object({
  experience: z.enum(['novice', 'developing', 'advanced']).optional(),
  uiMode: z.enum(['novice', 'pro']).optional(),
})

export default defineEventHandler(async (event) => {
  const sessionUser = await requireUser(event)
  const body = patchMeSchema.parse(await readBody(event))

  const db = useDb()

  const [updated] = await db
    .update(schema.users)
    .set({
      ...(body.experience ? { experience: body.experience } : {}),
      ...(body.uiMode ? { uiMode: body.uiMode } : {}),
    })
    .where(eq(schema.users.id, sessionUser.id))
    .returning()

  if (!updated) {
    throw createError({ statusCode: 404, statusMessage: 'User not found' })
  }

  await setUserSession(event, {
    user: toSessionUser(updated),
  })

  return { user: toSessionUser(updated) }
})
