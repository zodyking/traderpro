import { createWorkspaceSchema } from '#shared/schemas/workspace'
import { createWorkspace } from '../../domains/workspace/service'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const body = createWorkspaceSchema.parse(await readBody(event))
  const workspace = await createWorkspace(user.id, body)
  setResponseStatus(event, 201)
  return { workspace }
})
