import { getPlanVsExecution } from '../../domains/broker/service'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  return getPlanVsExecution(user.id)
})
