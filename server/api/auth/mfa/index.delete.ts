import { requireUser } from '../../../utils/auth'
import { disableMfa } from '../../../domains/identity/mfa'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  await disableMfa(user.id)
  return { ok: true }
})
