import { eq } from 'drizzle-orm'
import type { EmailNotificationKey, EmailNotificationPreferences } from '../../../shared/types/email'
import { users } from '../../../db/schema'
import { getSymbolById } from '../market-data/service'
import { getActiveUserById } from '../../utils/auth'
import { useDb } from '../../utils/db'
import { normalizeEmailPreferences } from './preferences'
import { sendRawEmail } from './client'
import {
  renderAlertEmail,
  renderBacktestEmail,
  renderLoginEmail,
  renderWelcomeEmail,
} from './templates'

function appUrl(): string {
  return (process.env.NUXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '')
}

function appName(): string {
  return process.env.NUXT_PUBLIC_APP_NAME || 'AxiomEdge'
}

export async function getUserEmailPreferences(
  userId: string,
): Promise<EmailNotificationPreferences> {
  const db = useDb()
  const [user] = await db
    .select({ emailPreferences: users.emailPreferences })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)

  return normalizeEmailPreferences(user?.emailPreferences)
}

export async function updateUserEmailPreferences(
  userId: string,
  patch: Partial<EmailNotificationPreferences>,
): Promise<EmailNotificationPreferences> {
  const current = await getUserEmailPreferences(userId)
  const next = { ...current, ...patch }
  const db = useDb()

  await db
    .update(users)
    .set({ emailPreferences: next })
    .where(eq(users.id, userId))

  return next
}

async function shouldSend(userId: string, kind: EmailNotificationKey): Promise<boolean> {
  const prefs = await getUserEmailPreferences(userId)
  return prefs[kind]
}

async function deliver(input: {
  userId: string
  kind: EmailNotificationKey
  to: string
  subject: string
  html: string
}) {
  if (!(await shouldSend(input.userId, input.kind))) {
    return false
  }

  return sendRawEmail({
    to: input.to,
    subject: input.subject,
    html: input.html,
  })
}

export async function notifyWelcome(user: {
  id: string
  email: string
  displayName: string
}) {
  return deliver({
    userId: user.id,
    kind: 'signUp',
    to: user.email,
    subject: 'Welcome to AxiomEdge',
    html: renderWelcomeEmail({
      displayName: user.displayName,
      appUrl: appUrl(),
      appName: appName(),
    }),
  })
}

export async function notifyLogin(user: {
  id: string
  email: string
  displayName: string
}, meta?: { ip?: string | null }) {
  return deliver({
    userId: user.id,
    kind: 'login',
    to: user.email,
    subject: 'New sign-in to AxiomEdge',
    html: renderLoginEmail({
      displayName: user.displayName,
      ip: meta?.ip ?? null,
      time: new Date().toUTCString(),
      appUrl: appUrl(),
      appName: appName(),
    }),
  })
}

export async function notifyAlertFired(input: {
  userId: string
  email: string
  displayName: string
  symbolLabel: string
  firedAt: string
}) {
  return deliver({
    userId: input.userId,
    kind: 'alerts',
    to: input.email,
    subject: `Alert triggered: ${input.symbolLabel}`,
    html: renderAlertEmail({
      displayName: input.displayName,
      symbolLabel: input.symbolLabel,
      firedAt: input.firedAt,
      appUrl: appUrl(),
      appName: appName(),
    }),
  })
}

export async function notifyBacktestComplete(input: {
  userId: string
  email: string
  displayName: string
  runId: string
  runLabel: string
  tradeCount: number
}) {
  return deliver({
    userId: input.userId,
    kind: 'backtests',
    to: input.email,
    subject: `Backtest complete: ${input.runLabel}`,
    html: renderBacktestEmail({
      displayName: input.displayName,
      runLabel: input.runLabel,
      tradeCount: input.tradeCount,
      runId: input.runId,
      appUrl: appUrl(),
      appName: appName(),
    }),
  })
}

export async function notifyAlertFiredForUser(
  userId: string,
  symbolId: string,
  firedAt: Date,
) {
  const user = await getActiveUserById(userId)
  if (!user) return false

  const symbol = await getSymbolById(symbolId)
  const symbolLabel = symbol
    ? `${symbol.ticker} · ${symbol.exchange}`
    : symbolId

  return notifyAlertFired({
    userId: user.id,
    email: user.email,
    displayName: user.displayName,
    symbolLabel,
    firedAt: firedAt.toUTCString(),
  })
}

export function queueAuthEmail(task: () => Promise<unknown>) {
  void task().catch((error) => {
    console.warn('[email] delivery failed', error)
  })
}
