import { updateWorkspaceSchema } from '#shared/schemas/workspace'
import { updateWorkspace } from '../../domains/workspace/service'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Workspace id required' })
  }

  const body = updateWorkspaceSchema.parse(await readBody(event))
  const workspace = await updateWorkspace(user.id, id, body)
  return { workspace }
})
