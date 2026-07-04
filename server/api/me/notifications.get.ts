import { requireUser } from '../../utils/auth'
import { getUserEmailPreferences } from '../../domains/email/service'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const preferences = await getUserEmailPreferences(user.id)

  return {
    preferences,
    smtpConfigured: Boolean(process.env.SMTP_HOST?.trim()),
  }
})
