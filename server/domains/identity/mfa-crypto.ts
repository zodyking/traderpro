import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from 'node:crypto'
import { generateSecret, verifySync } from 'otplib'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12
const AUTH_TAG_LENGTH = 16
const DEV_FALLBACK_KEY = 'axiomedge-dev-kms-fallback-key!!'

function getEncryptionKey(): Buffer {
  const masterKey = process.env.KMS_MASTER_KEY
  const source = masterKey || DEV_FALLBACK_KEY
  return scryptSync(source, 'axiomedge-mfa-v1', 32)
}

export function generateTotpSecret(): string {
  return generateSecret()
}

export function encryptSecret(plaintext: string): Buffer {
  const key = getEncryptionKey()
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, key, iv)
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ])
  const authTag = cipher.getAuthTag()
  return Buffer.concat([iv, authTag, encrypted])
}

export function decryptSecret(data: Buffer): string {
  const key = getEncryptionKey()
  const iv = data.subarray(0, IV_LENGTH)
  const authTag = data.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH)
  const ciphertext = data.subarray(IV_LENGTH + AUTH_TAG_LENGTH)
  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(authTag)
  return Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString('utf8')
}

export function verifyTotpCode(
  secret: string,
  code: string,
  options?: { epoch?: number },
): boolean {
  const result = verifySync({
    secret,
    token: code,
    epoch: options?.epoch,
  })
  return result.valid
}
