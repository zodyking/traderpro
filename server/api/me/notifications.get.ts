import { requireUser } from '../../utils/auth'
import { getSmtpStatus } from '../../domains/email/config'
import { getUserEmailPreferences } from '../../domains/email/service'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const preferences = await getUserEmailPreferences(user.id)
  const smtp = getSmtpStatus()

  return {
    preferences,
    smtpConfigured: smtp.configured,
    smtpFromEmail: smtp.fromEmail,
    smtpFromAddress: smtp.fromAddress,
    smtpFromEmailSource: smtp.fromEmailSource,
  }
})
