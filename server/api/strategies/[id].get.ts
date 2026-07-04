import { getStrategy } from '../../domains/strategy/service'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Strategy id required' })
  }

  const strategy = await getStrategy(user.id, id)
  return { strategy }
})
