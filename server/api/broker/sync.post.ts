import { brokerImportSchema } from '#shared/schemas/broker'
import { importCsv } from '../../domains/broker/service'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)

  let body: unknown
  const contentType = getHeader(event, 'content-type') ?? ''

  if (contentType.includes('multipart/form-data')) {
    const form = await readMultipartFormData(event)
    if (!form) throw createError({ statusCode: 400, statusMessage: 'Empty form data' })

    const get = (name: string) => form.find(f => f.name === name)?.data?.toString() ?? ''
    body = {
      broker: get('broker'),
      label: get('label'),
      csv: get('csv') || (form.find(f => f.name === 'file')?.data?.toString() ?? ''),
    }
  }
  else {
    body = await readBody(event)
  }

  const input = brokerImportSchema.parse(body)
  const result = await importCsv(user.id, input)

  setResponseStatus(event, 201)
  return result
})
