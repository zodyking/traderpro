import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12
const KEY_LENGTH = 32

function getMasterKey(): Buffer {
  const raw = process.env.KMS_MASTER_KEY
  if (!raw || raw.length < 16) {
    throw new Error('KMS_MASTER_KEY must be set (at least 16 characters)')
  }
  return scryptSync(raw, 'axiomedge-kms', KEY_LENGTH)
}

export function encryptJson(value: unknown): Buffer {
  const key = getMasterKey()
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, key, iv)
  const plaintext = Buffer.from(JSON.stringify(value), 'utf8')
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([iv, tag, encrypted])
}

export function decryptJson<T>(payload: Buffer | Uint8Array | null | undefined): T {
  if (!payload || payload.length === 0) {
    throw new Error('Encrypted payload is empty')
  }

  const key = getMasterKey()
  const buffer = Buffer.from(payload)
  const iv = buffer.subarray(0, IV_LENGTH)
  const tag = buffer.subarray(IV_LENGTH, IV_LENGTH + 16)
  const encrypted = buffer.subarray(IV_LENGTH + 16)
  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(tag)
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()])
  return JSON.parse(decrypted.toString('utf8')) as T
}
