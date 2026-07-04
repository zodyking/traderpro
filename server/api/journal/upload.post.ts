import { randomUUID } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join, extname } from 'node:path'

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp'])
const MAX_BYTES = 10 * 1024 * 1024

function saveLocally(buffer: Buffer, filename: string): string {
  const uploadDir = join(process.cwd(), '.data', 'uploads')
  mkdirSync(uploadDir, { recursive: true })
  writeFileSync(join(uploadDir, filename), buffer)
  return `/api/uploads/${filename}`
}

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
  const filename = `${randomUUID()}${ext}`
  const url = saveLocally(filePart.data, filename)

  return { url }
})
