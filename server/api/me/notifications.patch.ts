import { emailNotificationPreferencesSchema } from '#shared/schemas/email'
import { requireUser } from '../../utils/auth'
import { updateUserEmailPreferences } from '../../domains/email/service'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const body = emailNotificationPreferencesSchema.parse(await readBody(event))
  const preferences = await updateUserEmailPreferences(user.id, body)

  return { preferences }
})
