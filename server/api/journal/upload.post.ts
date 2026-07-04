import { extname } from 'node:path'
import { generateUploadFilename, uploadFile } from '../../domains/storage/s3'

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp'])
const MAX_BYTES = 10 * 1024 * 1024

export default defineEventHandler(async (event) => {
  await requireUser(event)

  const form = await readMultipartFormData(event)
  if (!form || form.length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'No file uploaded' })
  }

  const filePart = form.find(p => p.name === 'file') ?? form[0]
  if (!filePart?.data) {
    throw createError({ statusCode: 400, statusMessage: 'file field required' })
  }

  const contentType = filePart.type ?? 'application/octet-stream'
  if (!ALLOWED_TYPES.has(contentType)) {
    throw createError({ statusCode: 400, statusMessage: 'Only JPEG, PNG, GIF and WEBP images are allowed' })
  }

  if (filePart.data.length > MAX_BYTES) {
    throw createError({ statusCode: 413, statusMessage: 'File exceeds 10 MB limit' })
  }

  const ext = extname(filePart.filename ?? '') || `.${contentType.split('/')[1]}`
  const filename = generateUploadFilename(ext)
  const result = await uploadFile(filePart.data, filename, contentType)

  return { url: result.url, storage: result.storage }
})
