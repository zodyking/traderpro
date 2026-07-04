import { listConnections } from '../../domains/broker/service'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  return listConnections(user.id)
})
