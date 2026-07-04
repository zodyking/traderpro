import { createReadStream, existsSync, statSync } from 'node:fs'
import { join, extname, basename } from 'node:path'

const MIME_MAP: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
}

export default defineEventHandler((event) => {
  const filename = getRouterParam(event, 'filename') ?? ''

  if (!filename || filename.includes('..') || filename.includes('/')) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid filename' })
  }

  const uploadDir = join(process.cwd(), '.data', 'uploads')
  const filepath = join(uploadDir, basename(filename))

  if (!existsSync(filepath)) {
    throw createError({ statusCode: 404, statusMessage: 'File not found' })
  }

  const ext = extname(filename).toLowerCase()
  const contentType = MIME_MAP[ext] ?? 'application/octet-stream'

  setHeader(event, 'Content-Type', contentType)
  setHeader(event, 'Cache-Control', 'public, max-age=31536000, immutable')

  const stat = statSync(filepath)
  setHeader(event, 'Content-Length', stat.size)

  return sendStream(event, createReadStream(filepath))
})
