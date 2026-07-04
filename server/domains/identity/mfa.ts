import { and, eq, isNotNull, isNull } from 'drizzle-orm'
import { generateURI } from 'otplib'
import QRCode from 'qrcode'
import { v7 as uuidv7 } from 'uuid'
import { mfaMethods, users } from '../../../db/schema'
import { useDb } from '../../utils/db'
import {
  decryptSecret,
  encryptSecret,
  generateTotpSecret,
  verifyTotpCode,
} from './mfa-crypto'

export {
  decryptSecret,
  encryptSecret,
  generateTotpSecret,
  verifyTotpCode,
} from './mfa-crypto'

const ISSUER = 'AxiomEdge'

export async function isMfaEnabled(userId: string): Promise<boolean> {
  const db = useDb()
  const [row] = await db
    .select({ id: mfaMethods.id })
    .from(mfaMethods)
    .where(
      and(
        eq(mfaMethods.userId, userId),
        eq(mfaMethods.kind, 'totp'),
        isNotNull(mfaMethods.verifiedAt),
      ),
    )
    .limit(1)

  return !!row
}

export async function enrollTotp(userId: string): Promise<{
  secret: string
  otpauthUrl: string
  qrDataUrl: string
}> {
  const db = useDb()

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)

  if (!user || user.deletedAt) {
    throw createError({ statusCode: 404, statusMessage: 'User not found' })
  }

  const alreadyEnabled = await isMfaEnabled(userId)
  if (alreadyEnabled) {
    throw createError({
      statusCode: 409,
      statusMessage: 'MFA is already enabled. Disable it before enrolling again.',
    })
  }

  const secret = generateTotpSecret()
  const secretEnc = encryptSecret(secret)
  const id = uuidv7()

  await db
    .delete(mfaMethods)
    .where(
      and(
        eq(mfaMethods.userId, userId),
        eq(mfaMethods.kind, 'totp'),
        isNull(mfaMethods.verifiedAt),
      ),
    )

  await db.insert(mfaMethods).values({
    id,
    userId,
    kind: 'totp',
    secretEnc,
  })

  const otpauthUrl = generateURI({
    issuer: ISSUER,
    label: user.email,
    secret,
  })
  const qrDataUrl = await QRCode.toDataURL(otpauthUrl)

  return { secret, otpauthUrl, qrDataUrl }
}

export async function confirmTotp(userId: string, code: string): Promise<void> {
  const db = useDb()
  const [method] = await db
    .select()
    .from(mfaMethods)
    .where(
      and(
        eq(mfaMethods.userId, userId),
        eq(mfaMethods.kind, 'totp'),
        isNull(mfaMethods.verifiedAt),
      ),
    )
    .limit(1)

  if (!method) {
    throw createError({
      statusCode: 400,
      statusMessage: 'No pending MFA enrollment found',
    })
  }

  const secret = decryptSecret(method.secretEnc)
  if (!verifyTotpCode(secret, code)) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Invalid verification code',
    })
  }

  await db
    .update(mfaMethods)
    .set({ verifiedAt: new Date() })
    .where(eq(mfaMethods.id, method.id))
}

export async function disableMfa(userId: string): Promise<void> {
  const db = useDb()
  await db
    .delete(mfaMethods)
    .where(
      and(
        eq(mfaMethods.userId, userId),
        eq(mfaMethods.kind, 'totp'),
      ),
    )
}

export async function verifyUserTotpCode(userId: string, code: string): Promise<boolean> {
  const db = useDb()
  const [method] = await db
    .select()
    .from(mfaMethods)
    .where(
      and(
        eq(mfaMethods.userId, userId),
        eq(mfaMethods.kind, 'totp'),
        isNotNull(mfaMethods.verifiedAt),
      ),
    )
    .limit(1)

  if (!method) {
    return false
  }

  const secret = decryptSecret(method.secretEnc)
  return verifyTotpCode(secret, code)
}
