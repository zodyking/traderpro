import { requireUser } from '../../../utils/auth'
import { isMfaEnabled } from '../../../domains/identity/mfa'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const enabled = await isMfaEnabled(user.id)
  return { enabled }
})
