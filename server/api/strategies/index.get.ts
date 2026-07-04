import { listStrategies } from '../../domains/strategy/service'

export default defineEventHandler(async (event) => {
  const user = await requireUserOrApiKey(event)
  const strategies = await listStrategies(user.id)
  return { strategies }
})
