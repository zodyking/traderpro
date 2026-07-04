import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mockSend = vi.fn()
const mockGetSignedUrl = vi.fn()

vi.mock('@aws-sdk/client-s3', () => {
  class PutObjectCommand {
    input: unknown
    constructor(input: unknown) {
      this.input = input
    }
  }

  class GetObjectCommand {
    input: unknown
    constructor(input: unknown) {
      this.input = input
    }
  }

  class S3Client {
    send = mockSend
  }

  return {
    S3Client,
    PutObjectCommand,
    GetObjectCommand,
  }
})

vi.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: (...args: unknown[]) => mockGetSignedUrl(...args),
}))

describe('S3 storage', () => {
  const uploadDir = join(process.cwd(), '.data', 'uploads')
  const envKeys = [
    'S3_BUCKET',
    'S3_REGION',
    'S3_ACCESS_KEY_ID',
    'S3_SECRET_ACCESS_KEY',
    'S3_ENDPOINT',
    'S3_PUBLIC_BASE_URL',
  ] as const

  const originalEnv: Record<string, string | undefined> = {}

  beforeEach(() => {
    vi.clearAllMocks()
    mockSend.mockResolvedValue({})
    mockGetSignedUrl.mockResolvedValue('https://signed.example.com/object')

    for (const key of envKeys) {
      originalEnv[key] = process.env[key]
      delete process.env[key]
    }
  })

  afterEach(() => {
    for (const key of envKeys) {
      if (originalEnv[key] === undefined) {
        delete process.env[key]
      }
      else {
        process.env[key] = originalEnv[key]
      }
    }

    rmSync(uploadDir, { recursive: true, force: true })
    vi.resetModules()
  })

  async function loadS3Module() {
    const mod = await import('../server/domains/storage/s3')
    mod.resetS3ClientForTests()
    return mod
  }

  it('reports S3 as unconfigured when credentials are missing', async () => {
    const { isS3Configured } = await loadS3Module()
    expect(isS3Configured()).toBe(false)
  })

  it('reports S3 as configured when required env vars are set', async () => {
    process.env.S3_BUCKET = 'axiomedge'
    process.env.S3_ACCESS_KEY_ID = 'test-key'
    process.env.S3_SECRET_ACCESS_KEY = 'test-secret'

    const { isS3Configured } = await loadS3Module()
    expect(isS3Configured()).toBe(true)
  })

  it('falls back to local storage when S3 is not configured', async () => {
    const { uploadFile } = await loadS3Module()
    const buffer = Buffer.from('local-image')

    const result = await uploadFile(buffer, 'photo.png', 'image/png')

    expect(result.storage).toBe('local')
    expect(result.url).toBe('/api/uploads/photo.png')
    expect(readFileSync(join(uploadDir, 'photo.png')).toString()).toBe('local-image')
    expect(mockSend).not.toHaveBeenCalled()
  })

  it('uploads to S3 with PutObjectCommand when configured', async () => {
    process.env.S3_BUCKET = 'axiomedge'
    process.env.S3_REGION = 'us-east-1'
    process.env.S3_ACCESS_KEY_ID = 'test-key'
    process.env.S3_SECRET_ACCESS_KEY = 'test-secret'

    const { uploadFile } = await loadS3Module()
    const buffer = Buffer.from('s3-image')

    const result = await uploadFile(buffer, 'photo.png', 'image/png')

    expect(result.storage).toBe('s3')
    expect(mockSend).toHaveBeenCalledOnce()
    expect(mockGetSignedUrl).toHaveBeenCalledOnce()
    expect(result.url).toBe('https://signed.example.com/object')
  })

  it('builds a public URL when S3_PUBLIC_BASE_URL is set', async () => {
    process.env.S3_BUCKET = 'axiomedge'
    process.env.S3_ACCESS_KEY_ID = 'test-key'
    process.env.S3_SECRET_ACCESS_KEY = 'test-secret'
    process.env.S3_PUBLIC_BASE_URL = 'https://cdn.example.com'

    const { getObjectUrl } = await loadS3Module()
    const url = await getObjectUrl('uploads/photo.png')

    expect(url).toBe('https://cdn.example.com/uploads/photo.png')
    expect(mockGetSignedUrl).not.toHaveBeenCalled()
  })

  it('builds an endpoint-style public URL for S3-compatible storage', async () => {
    const { buildS3PublicUrl, isS3Configured } = await loadS3Module()

    process.env.S3_BUCKET = 'axiomedge'
    process.env.S3_ENDPOINT = 'https://minio.local'

    expect(isS3Configured()).toBe(false)
    expect(buildS3PublicUrl('uploads/photo.png')).toBe('https://minio.local/axiomedge/uploads/photo.png')
  })

  it('generates unique upload filenames with the provided extension', async () => {
    const { generateUploadFilename } = await loadS3Module()

    expect(generateUploadFilename('.png')).toMatch(/^[0-9a-f-]+\.png$/i)
  })

  it('creates the local upload directory when saving locally', async () => {
    mkdirSync(uploadDir, { recursive: true })
    writeFileSync(join(uploadDir, '.gitkeep'), '')

    const { uploadFile } = await loadS3Module()
    await uploadFile(Buffer.from('data'), 'new-file.webp', 'image/webp')

    expect(readFileSync(join(uploadDir, 'new-file.webp')).toString()).toBe('data')
  })
})
