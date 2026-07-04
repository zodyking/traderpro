import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'

export type UploadResult = {
  url: string
  storage: 's3' | 'local'
}

function isS3Configured(): boolean {
  return !!(
    process.env.S3_BUCKET
    && process.env.S3_ACCESS_KEY_ID
    && process.env.S3_SECRET_ACCESS_KEY
  )
}

function saveLocally(buffer: Buffer, filename: string): string {
  const uploadDir = join(process.cwd(), '.data', 'uploads')
  mkdirSync(uploadDir, { recursive: true })
  writeFileSync(join(uploadDir, filename), buffer)
  return `/api/uploads/${filename}`
}

function buildS3Url(key: string): string {
  const bucket = process.env.S3_BUCKET!
  const region = process.env.S3_REGION || 'us-east-1'
  const endpoint = process.env.S3_ENDPOINT

  if (endpoint) {
    const base = endpoint.replace(/\/$/, '')
    return `${base}/${bucket}/${key}`
  }

  return `https://${bucket}.s3.${region}.amazonaws.com/${key}`
}

export async function uploadFile(
  buffer: Buffer,
  filename: string,
  _contentType: string,
): Promise<UploadResult> {
  if (isS3Configured()) {
    const key = `uploads/${filename}`
    // Stub: no real S3 SDK upload; return a mock object URL.
    return {
      url: buildS3Url(key),
      storage: 's3',
    }
  }

  return {
    url: saveLocally(buffer, filename),
    storage: 'local',
  }
}

export function generateUploadFilename(ext: string): string {
  return `${randomUUID()}${ext}`
}
