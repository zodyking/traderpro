import { mfaVerifySchema } from '#shared/schemas/auth'
import { requireUser } from '../../../utils/auth'
import { confirmTotp } from '../../../domains/identity/mfa'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const body = mfaVerifySchema.parse(await readBody(event))
  await confirmTotp(user.id, body.code)
  return { ok: true }
})
