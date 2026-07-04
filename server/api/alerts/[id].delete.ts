import { deleteAlert } from '../../domains/alerts/service'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const alertId = getRouterParam(event, 'id')!
  await deleteAlert(user.id, alertId)
  setResponseStatus(event, 204)
  return null
})
