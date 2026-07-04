import { describe, expect, it } from 'vitest'
import { generate, generateSecret } from 'otplib'
import {
  decryptSecret,
  encryptSecret,
  verifyTotpCode,
} from '../server/domains/identity/mfa-crypto'

describe('encryptSecret / decryptSecret', () => {
  it('round-trips a TOTP secret', () => {
    const secret = 'JBSWY3DPEHPK3PXP'
    const encrypted = encryptSecret(secret)
    expect(encrypted).toBeInstanceOf(Buffer)
    expect(encrypted.length).toBeGreaterThan(secret.length)
    expect(decryptSecret(encrypted)).toBe(secret)
  })
})

describe('verifyTotpCode', () => {
  const secret = generateSecret()
  const epoch = 1_700_000_000

  it('accepts a valid code for the current period', async () => {
    const token = await generate({ secret, epoch })
    expect(verifyTotpCode(secret, token, { epoch })).toBe(true)
  })

  it('rejects an invalid code', () => {
    expect(verifyTotpCode(secret, '000000', { epoch })).toBe(false)
  })

  it('rejects a code from a different period without tolerance', async () => {
    const token = await generate({ secret, epoch })
    const shiftedEpoch = epoch + 120
    expect(verifyTotpCode(secret, token, { epoch: shiftedEpoch })).toBe(false)
  })
})
