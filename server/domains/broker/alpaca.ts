import { and, eq, sql } from 'drizzle-orm'
import { v7 as uuidv7 } from 'uuid'
import { brokerAccounts, brokerConnections, executions, symbols } from '../../../db/schema'
import type { ParsedExecution } from './csv-parser'
import { decryptJson, encryptJson } from '../../utils/kms'
import { useDb } from '../../utils/db'

const ALPACA_AUTH_URL = 'https://app.alpaca.markets/oauth/authorize'
const ALPACA_TOKEN_URL = 'https://api.alpaca.markets/oauth/token'
const ALPACA_API_BASE = 'https://api.alpaca.markets'

export type AlpacaOAuthTokens = {
  accessToken: string
  refreshToken: string
  expiresAt: string
  tokenType?: string
  scope?: string
}

export type AlpacaStoredCreds = AlpacaOAuthTokens & {
  accountId?: string
  accountNumber?: string
}

export type AlpacaAccount = {
  id: string
  account_number: string
  status: string
  currency: string
  equity?: string
  cash?: string
  buying_power?: string
}

type AlpacaFillActivity = {
  id: string
  activity_type: string
  transaction_time: string
  type: string
  price: string
  qty: string
  side: string
  symbol: string
  order_id?: string
}

function getAlpacaConfig() {
  const clientId = process.env.ALPACA_CLIENT_ID
  const clientSecret = process.env.ALPACA_CLIENT_SECRET
  const redirectUri = process.env.ALPACA_REDIRECT_URI

  if (!clientId || !clientSecret || !redirectUri) {
    throw createError({
      statusCode: 503,
      statusMessage: 'Alpaca OAuth is not configured',
    })
  }

  return { clientId, clientSecret, redirectUri }
}

export function isAlpacaOAuthConfigured(): boolean {
  return Boolean(
    process.env.ALPACA_CLIENT_ID
    && process.env.ALPACA_CLIENT_SECRET
    && process.env.ALPACA_REDIRECT_URI,
  )
}

export function buildAuthorizeUrl(state: string): string {
  const { clientId, redirectUri } = getAlpacaConfig()
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    state,
    scope: 'account:read trading:read',
  })
  return `${ALPACA_AUTH_URL}?${params.toString()}`
}

async function postToken(body: Record<string, string>): Promise<AlpacaOAuthTokens> {
  const { clientId, clientSecret } = getAlpacaConfig()
  const response = await fetch(ALPACA_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      ...body,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  })

  if (!response.ok) {
    const text = await response.text()
    throw createError({
      statusCode: 502,
      statusMessage: `Alpaca token exchange failed: ${text.slice(0, 200)}`,
    })
  }

  const data = await response.json() as {
    access_token: string
    refresh_token: string
    expires_in: number
    token_type?: string
    scope?: string
  }

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: new Date(Date.now() + data.expires_in * 1000).toISOString(),
    tokenType: data.token_type,
    scope: data.scope,
  }
}

export async function exchangeCode(code: string): Promise<AlpacaOAuthTokens> {
  const { redirectUri } = getAlpacaConfig()
  return postToken({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
  })
}

export async function refreshAccessToken(refreshToken: string): Promise<AlpacaOAuthTokens> {
  return postToken({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  })
}

async function alpacaFetch<T>(accessToken: string, path: string): Promise<T> {
  const response = await fetch(`${ALPACA_API_BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Alpaca API ${path} failed (${response.status}): ${text.slice(0, 200)}`)
  }

  return response.json() as Promise<T>
}

export async function fetchAccount(accessToken: string): Promise<AlpacaAccount> {
  return alpacaFetch<AlpacaAccount>(accessToken, '/v2/account')
}

function mapFillActivity(activity: AlpacaFillActivity): ParsedExecution | null {
  if (activity.activity_type !== 'FILL' && activity.type !== 'fill') {
    return null
  }

  const side = activity.side?.toLowerCase() === 'sell' ? 'sell' : 'buy'
  const qty = Number.parseFloat(activity.qty)
  const price = Number.parseFloat(activity.price)
  if (!Number.isFinite(qty) || !Number.isFinite(price)) {
    return null
  }

  return {
    rawSymbol: activity.symbol,
    side,
    qty,
    price,
    fees: 0,
    executedAt: new Date(activity.transaction_time),
    orderRef: activity.order_id ?? activity.id,
    sourcePayload: activity as unknown as Record<string, unknown>,
  }
}

export async function fetchExecutions(
  accessToken: string,
  options: { pageSize?: number } = {},
): Promise<ParsedExecution[]> {
  const pageSize = options.pageSize ?? 100
  const activities = await alpacaFetch<AlpacaFillActivity[]>(
    accessToken,
    `/v2/account/activities/FILL?direction=desc&page_size=${pageSize}`,
  )

  return activities
    .map(mapFillActivity)
    .filter((row): row is ParsedExecution => row != null)
}

export function encryptCreds(creds: AlpacaStoredCreds): Buffer {
  return encryptJson(creds)
}

export function decryptCreds(payload: Buffer | Uint8Array | null | undefined): AlpacaStoredCreds {
  return decryptJson<AlpacaStoredCreds>(payload)
}

export async function ensureValidAccessToken(creds: AlpacaStoredCreds): Promise<AlpacaStoredCreds> {
  const expiresAt = new Date(creds.expiresAt).getTime()
  if (expiresAt > Date.now() + 60_000) {
    return creds
  }

  const refreshed = await refreshAccessToken(creds.refreshToken)
  return {
    ...creds,
    ...refreshed,
  }
}

export async function upsertAlpacaConnection(
  userId: string,
  tokens: AlpacaOAuthTokens,
  account: AlpacaAccount,
) {
  const db = useDb()
  const label = account.account_number || account.id
  const creds: AlpacaStoredCreds = {
    ...tokens,
    accountId: account.id,
    accountNumber: account.account_number,
  }

  const [existing] = await db
    .select()
    .from(brokerConnections)
    .where(
      and(
        eq(brokerConnections.userId, userId),
        eq(brokerConnections.broker, 'alpaca'),
        eq(brokerConnections.label, label),
      ),
    )
    .limit(1)

  let connectionId: string
  if (existing) {
    connectionId = existing.id
    await db
      .update(brokerConnections)
      .set({
        credsEnc: encryptCreds(creds),
        status: 'connected',
        lastSyncAt: new Date(),
      })
      .where(eq(brokerConnections.id, connectionId))
  }
  else {
    connectionId = uuidv7()
    await db.insert(brokerConnections).values({
      id: connectionId,
      userId,
      broker: 'alpaca',
      label,
      credsEnc: encryptCreds(creds),
      status: 'connected',
      lastSyncAt: new Date(),
    })
  }

  const [existingAccount] = await db
    .select()
    .from(brokerAccounts)
    .where(eq(brokerAccounts.connectionId, connectionId))
    .limit(1)

  let accountId: string
  if (existingAccount) {
    accountId = existingAccount.id
    await db
      .update(brokerAccounts)
      .set({
        accountRef: account.account_number,
        currency: account.currency || 'USD',
        equity: account.equity ?? null,
        cash: account.cash ?? null,
        buyingPower: account.buying_power ?? null,
        snapshotAt: new Date(),
      })
      .where(eq(brokerAccounts.id, accountId))
  }
  else {
    accountId = uuidv7()
    await db.insert(brokerAccounts).values({
      id: accountId,
      connectionId,
      userId,
      accountRef: account.account_number,
      currency: account.currency || 'USD',
      equity: account.equity ?? null,
      cash: account.cash ?? null,
      buyingPower: account.buying_power ?? null,
      snapshotAt: new Date(),
    })
  }

  return { connectionId, accountId }
}

export async function importExecutions(
  userId: string,
  connectionId: string,
  rows: ParsedExecution[],
) {
  const db = useDb()

  const [connection] = await db
    .select()
    .from(brokerConnections)
    .where(and(eq(brokerConnections.id, connectionId), eq(brokerConnections.userId, userId)))
    .limit(1)

  if (!connection) {
    throw createError({ statusCode: 404, statusMessage: 'Broker connection not found' })
  }

  const [account] = await db
    .select()
    .from(brokerAccounts)
    .where(eq(brokerAccounts.connectionId, connectionId))
    .limit(1)

  if (!account) {
    throw createError({ statusCode: 404, statusMessage: 'Broker account not found' })
  }

  const uniqueSymbols = [...new Set(rows.map(r => r.rawSymbol.toUpperCase()))]
  const symbolMap = new Map<string, string | null>()

  for (const ticker of uniqueSymbols) {
    const match = await db
      .select({ id: symbols.id })
      .from(symbols)
      .where(eq(sql`upper(${symbols.ticker})`, ticker))
      .limit(1)
    symbolMap.set(ticker, match[0]?.id ?? null)
  }

  let inserted = 0
  let skipped = 0

  for (const row of rows) {
    const symbolId = symbolMap.get(row.rawSymbol.toUpperCase()) ?? null

    if (row.orderRef) {
      const dup = await db
        .select({ id: executions.id })
        .from(executions)
        .where(
          and(
            eq(executions.accountId, account.id),
            eq(executions.orderRef, row.orderRef),
          ),
        )
        .limit(1)

      if (dup.length > 0) {
        skipped++
        continue
      }
    }

    await db.insert(executions).values({
      id: uuidv7(),
      userId,
      accountId: account.id,
      symbolId,
      rawSymbol: row.rawSymbol,
      side: row.side,
      qty: row.qty,
      price: row.price,
      fees: String(row.fees),
      executedAt: row.executedAt,
      orderRef: row.orderRef ?? null,
      sourcePayload: row.sourcePayload,
    })
    inserted++
  }

  return {
    connectionId,
    accountId: account.id,
    inserted,
    skipped,
    parseErrors: [] as Array<{ line: number, message: string }>,
    unresolvedSymbols: uniqueSymbols.filter(t => symbolMap.get(t) === null),
  }
}

export async function syncAlpacaConnection(userId: string, connectionId: string) {
  const db = useDb()

  const [connection] = await db
    .select()
    .from(brokerConnections)
    .where(and(eq(brokerConnections.id, connectionId), eq(brokerConnections.userId, userId)))
    .limit(1)

  if (!connection || connection.broker !== 'alpaca') {
    throw createError({ statusCode: 404, statusMessage: 'Alpaca connection not found' })
  }

  let creds = decryptCreds(connection.credsEnc)
  creds = await ensureValidAccessToken(creds)

  if (creds.expiresAt !== decryptCreds(connection.credsEnc).expiresAt) {
    await db
      .update(brokerConnections)
      .set({ credsEnc: encryptCreds(creds) })
      .where(eq(brokerConnections.id, connectionId))
  }

  const account = await fetchAccount(creds.accessToken)
  await upsertAlpacaConnection(userId, creds, account)

  const rows = await fetchExecutions(creds.accessToken)
  return importExecutions(userId, connectionId, rows)
}
