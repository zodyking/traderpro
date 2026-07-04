import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

export type UploadResult = {
  url: string
  storage: 's3' | 'local'
}

const SIGNED_URL_EXPIRY_SECONDS = 7 * 24 * 60 * 60

let s3Client: S3Client | undefined

export function isS3Configured(): boolean {
  return !!(
    process.env.S3_BUCKET
    && process.env.S3_ACCESS_KEY_ID
    && process.env.S3_SECRET_ACCESS_KEY
  )
}

function getS3Client(): S3Client {
  if (!s3Client) {
    s3Client = new S3Client({
      region: process.env.S3_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY_ID!,
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
      },
      ...(process.env.S3_ENDPOINT
        ? {
            endpoint: process.env.S3_ENDPOINT,
            forcePathStyle: true,
          }
        : {}),
    })
  }

  return s3Client
}

function saveLocally(buffer: Buffer, filename: string): string {
  const uploadDir = join(process.cwd(), '.data', 'uploads')
  mkdirSync(uploadDir, { recursive: true })
  writeFileSync(join(uploadDir, filename), buffer)
  return `/api/uploads/${filename}`
}

export function buildS3PublicUrl(key: string): string {
  const bucket = process.env.S3_BUCKET!
  const region = process.env.S3_REGION || 'us-east-1'
  const endpoint = process.env.S3_ENDPOINT
  const publicBase = process.env.S3_PUBLIC_BASE_URL

  if (publicBase) {
    return `${publicBase.replace(/\/$/, '')}/${key}`
  }

  if (endpoint) {
    const base = endpoint.replace(/\/$/, '')
    return `${base}/${bucket}/${key}`
  }

  return `https://${bucket}.s3.${region}.amazonaws.com/${key}`
}

export async function getObjectUrl(key: string): Promise<string> {
  if (process.env.S3_PUBLIC_BASE_URL) {
    return buildS3PublicUrl(key)
  }

  const client = getS3Client()
  return getSignedUrl(
    client,
    new GetObjectCommand({
      Bucket: process.env.S3_BUCKET!,
      Key: key,
    }),
    { expiresIn: SIGNED_URL_EXPIRY_SECONDS },
  )
}

async function uploadToS3(
  buffer: Buffer,
  key: string,
  contentType: string,
): Promise<UploadResult> {
  const client = getS3Client()

  await client.send(
    new PutObjectCommand({
      Bucket: process.env.S3_BUCKET!,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    }),
  )

  return {
    url: await getObjectUrl(key),
    storage: 's3',
  }
}

export async function uploadFile(
  buffer: Buffer,
  filename: string,
  contentType: string,
): Promise<UploadResult> {
  if (isS3Configured()) {
    const key = `uploads/${filename}`
    return uploadToS3(buffer, key, contentType)
  }

  return {
    url: saveLocally(buffer, filename),
    storage: 'local',
  }
}

export function generateUploadFilename(ext: string): string {
  return `${randomUUID()}${ext}`
}

export function resetS3ClientForTests(): void {
  s3Client = undefined
}
