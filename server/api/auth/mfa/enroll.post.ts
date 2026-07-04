import { requireUser } from '../../../utils/auth'
import { enrollTotp } from '../../../domains/identity/mfa'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  return enrollTotp(user.id)
})
