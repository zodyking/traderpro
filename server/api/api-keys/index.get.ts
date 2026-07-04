import { listApiKeys } from '../../domains/identity/api-keys'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const keys = await listApiKeys(user.id)
  return { keys }
})
