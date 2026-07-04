import { and, asc, between, desc, eq, gte, isNotNull, lte, sql } from 'drizzle-orm'
import { v7 as uuidv7 } from 'uuid'
import {
  brokerAccounts,
  brokerConnections,
  executions,
  journalEntries,
  symbols,
} from '../../../db/schema'
import type {
  AttributionData,
  AttributionRow,
  BrokerExecutionsQuery,
  BrokerImportInput,
  CalendarPnlData,
  PerformanceSummary,
} from '../../../shared/schemas/broker'
import { useDb } from '../../utils/db'
import { parseBrokerCsv } from './csv-parser'

export async function importCsv(userId: string, input: BrokerImportInput) {
  const db = useDb()

  const { rows, errors } = parseBrokerCsv(input.csv, input.broker)

  if (rows.length === 0) {
    throw createError({
      statusCode: 422,
      statusMessage: errors.length > 0
        ? `No valid rows parsed. First error: ${errors[0]!.message}`
        : 'CSV contained no parseable trade rows.',
    })
  }

  // Upsert broker connection (one per broker+label combo per user)
  const existingConnections = await db
    .select()
    .from(brokerConnections)
    .where(
      and(
        eq(brokerConnections.userId, userId),
        eq(brokerConnections.broker, input.broker),
        eq(brokerConnections.label, input.label),
      ),
    )
    .limit(1)

  let connectionId: string
  if (existingConnections.length > 0) {
    connectionId = existingConnections[0]!.id
    await db
      .update(brokerConnections)
      .set({ lastSyncAt: new Date(), status: 'connected' })
      .where(eq(brokerConnections.id, connectionId))
  }
  else {
    connectionId = uuidv7()
    await db.insert(brokerConnections).values({
      id: connectionId,
      userId,
      broker: input.broker,
      label: input.label,
      status: 'connected',
      lastSyncAt: new Date(),
    })
  }

  // Upsert broker account (one default account per connection)
  const existingAccounts = await db
    .select()
    .from(brokerAccounts)
    .where(eq(brokerAccounts.connectionId, connectionId))
    .limit(1)

  let accountId: string
  if (existingAccounts.length > 0) {
    accountId = existingAccounts[0]!.id
  }
  else {
    accountId = uuidv7()
    await db.insert(brokerAccounts).values({
      id: accountId,
      connectionId,
      userId,
      accountRef: input.label,
      currency: 'USD',
    })
  }

  // Resolve symbols — try to match raw_symbol against ticker in symbols table
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

  const unresolvedSymbols = uniqueSymbols.filter(t => symbolMap.get(t) === null)

  // Insert executions — skip duplicates by orderRef if present
  let inserted = 0
  let skipped = 0

  for (const row of rows) {
    const symbolId = symbolMap.get(row.rawSymbol.toUpperCase()) ?? null

    // Dedup: if orderRef provided, skip if it already exists for this account
    if (row.orderRef) {
      const dup = await db
        .select({ id: executions.id })
        .from(executions)
        .where(
          and(
            eq(executions.accountId, accountId),
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
      accountId,
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
    accountId,
    inserted,
    skipped,
    parseErrors: errors,
    unresolvedSymbols,
  }
}

export async function listConnections(userId: string) {
  const db = useDb()

  const rows = await db
    .select({
      id: brokerConnections.id,
      broker: brokerConnections.broker,
      label: brokerConnections.label,
      status: brokerConnections.status,
      lastSyncAt: brokerConnections.lastSyncAt,
      createdAt: brokerConnections.createdAt,
    })
    .from(brokerConnections)
    .where(eq(brokerConnections.userId, userId))
    .orderBy(desc(brokerConnections.createdAt))

  const result = []
  for (const conn of rows) {
    const [countRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(brokerAccounts)
      .where(eq(brokerAccounts.connectionId, conn.id))

    result.push({
      ...conn,
      lastSyncAt: conn.lastSyncAt?.toISOString() ?? null,
      createdAt: conn.createdAt.toISOString(),
      accountCount: countRow?.count ?? 0,
    })
  }

  return result
}

export async function listExecutions(userId: string, query: BrokerExecutionsQuery) {
  const db = useDb()

  const conditions = [eq(executions.userId, userId)]
  if (query.accountId) conditions.push(eq(executions.accountId, query.accountId))
  if (query.from && query.to) {
    conditions.push(between(executions.executedAt, new Date(query.from), new Date(query.to)))
  }
  else if (query.from) {
    conditions.push(gte(executions.executedAt, new Date(query.from)))
  }
  else if (query.to) {
    conditions.push(lte(executions.executedAt, new Date(query.to)))
  }

  const rows = await db
    .select()
    .from(executions)
    .where(and(...conditions))
    .orderBy(desc(executions.executedAt))
    .limit(query.limit)

  return rows.map(r => ({
    id: r.id,
    accountId: r.accountId,
    symbolId: r.symbolId,
    rawSymbol: r.rawSymbol,
    side: r.side as 'buy' | 'sell',
    qty: r.qty,
    price: r.price,
    fees: r.fees,
    executedAt: r.executedAt.toISOString(),
    orderRef: r.orderRef,
  }))
}

type FifoLot = { qty: number, price: number }

type FifoTrade = {
  symbol: string
  pnl: number
  win: boolean
  exitedAt: Date
  executionId: string
}

function computeFifoPnlWithDates(
  rows: Array<{ id: string, rawSymbol: string, side: string, qty: number, price: number, fees: number, executedAt: Date }>,
): FifoTrade[] {
  const bySymbol = new Map<string, typeof rows>()
  for (const row of rows) {
    const key = row.rawSymbol.toUpperCase()
    if (!bySymbol.has(key)) bySymbol.set(key, [])
    bySymbol.get(key)!.push(row)
  }

  const trades: FifoTrade[] = []

  for (const [symbol, symbolRows] of bySymbol) {
    const ordered = [...symbolRows].sort((a, b) => a.executedAt.getTime() - b.executedAt.getTime())
    const lots: FifoLot[] = []

    for (const row of ordered) {
      if (row.side === 'buy') {
        lots.push({ qty: row.qty, price: row.price })
      }
      else {
        let remaining = row.qty
        let costBasis = 0
        while (remaining > 0 && lots.length > 0) {
          const lot = lots[0]!
          const matched = Math.min(remaining, lot.qty)
          costBasis += matched * lot.price
          remaining -= matched
          lot.qty -= matched
          if (lot.qty <= 0) lots.shift()
        }
        if (row.qty - remaining > 0) {
          const matchedQty = row.qty - remaining
          const proceeds = matchedQty * row.price
          const pnl = proceeds - costBasis - row.fees
          trades.push({ symbol, pnl, win: pnl > 0, exitedAt: row.executedAt, executionId: row.id })
        }
      }
    }
  }

  return trades
}

function sessionLabel(date: Date): string {
  const utcHour = date.getUTCHours()
  const utcMinute = date.getUTCMinutes()
  const minuteOfDay = utcHour * 60 + utcMinute
  // Approximate US Eastern (UTC-4 EDT): subtract 240 minutes
  const etMinute = ((minuteOfDay - 240) + 1440) % 1440
  if (etMinute < 570) return 'Pre-Market (<9:30 ET)'      // before 9:30 ET
  if (etMinute < 660) return 'Open (9:30–11 ET)'
  if (etMinute < 840) return 'Midday (11–14 ET)'
  if (etMinute < 960) return 'Afternoon (14–16 ET)'
  return 'After Hours (>16 ET)'
}

function computeAttributionRows(trades: FifoTrade[], keyFn: (t: FifoTrade) => string): AttributionRow[] {
  const map = new Map<string, { trades: number, pnl: number, wins: number }>()
  for (const t of trades) {
    const key = keyFn(t)
    const entry = map.get(key) ?? { trades: 0, pnl: 0, wins: 0 }
    entry.trades++
    entry.pnl += t.pnl
    if (t.win) entry.wins++
    map.set(key, entry)
  }
  return [...map.entries()]
    .map(([label, v]) => ({
      label,
      trades: v.trades,
      pnl: Math.round(v.pnl * 100) / 100,
      winRate: v.trades > 0 ? Math.round((v.wins / v.trades) * 1000) / 1000 : null,
    }))
    .sort((a, b) => Math.abs(b.pnl) - Math.abs(a.pnl))
}

function computeFifoPnl(rows: Array<{ rawSymbol: string, side: string, qty: number, price: number, fees: number }>) {
  // Group by symbol
  const bySymbol = new Map<string, typeof rows>()
  for (const row of rows) {
    const key = row.rawSymbol.toUpperCase()
    if (!bySymbol.has(key)) bySymbol.set(key, [])
    bySymbol.get(key)!.push(row)
  }

  const trades: Array<{ symbol: string, pnl: number, win: boolean }> = []

  for (const [symbol, symbolRows] of bySymbol) {
    // Sort by execution order (already sorted by executedAt desc so we reverse)
    const ordered = [...symbolRows].reverse()
    const lots: FifoLot[] = []

    for (const row of ordered) {
      if (row.side === 'buy') {
        lots.push({ qty: row.qty, price: row.price })
      }
      else {
        // sell — match against FIFO lots
        let remaining = row.qty
        let costBasis = 0
        while (remaining > 0 && lots.length > 0) {
          const lot = lots[0]!
          const matched = Math.min(remaining, lot.qty)
          costBasis += matched * lot.price
          remaining -= matched
          lot.qty -= matched
          if (lot.qty <= 0) lots.shift()
        }
        if (row.qty - remaining > 0) {
          const matchedQty = row.qty - remaining
          const proceeds = matchedQty * row.price
          const pnl = proceeds - costBasis - row.fees
          trades.push({ symbol, pnl, win: pnl > 0 })
        }
      }
    }
  }

  return trades
}

export async function getPerformanceSummary(userId: string, accountId?: string): Promise<PerformanceSummary> {
  const db = useDb()

  const conditions = [eq(executions.userId, userId)]
  if (accountId) conditions.push(eq(executions.accountId, accountId))

  const rows = await db
    .select()
    .from(executions)
    .where(and(...conditions))
    .orderBy(asc(executions.executedAt))

  const totalFees = rows.reduce((sum, r) => sum + Number.parseFloat(r.fees), 0)

  const execData = rows.map(r => ({
    rawSymbol: r.rawSymbol,
    side: r.side,
    qty: r.qty,
    price: r.price,
    fees: Number.parseFloat(r.fees),
  }))

  const trades = computeFifoPnl(execData)
  const totalPnl = trades.reduce((s, t) => s + t.pnl, 0)
  const wins = trades.filter(t => t.win)
  const losses = trades.filter(t => !t.win)

  const winRate = trades.length > 0 ? wins.length / trades.length : null
  const avgWin = wins.length > 0 ? wins.reduce((s, t) => s + t.pnl, 0) / wins.length : null
  const avgLoss = losses.length > 0 ? losses.reduce((s, t) => s + t.pnl, 0) / losses.length : null
  const bestTrade = trades.length > 0 ? Math.max(...trades.map(t => t.pnl)) : null
  const worstTrade = trades.length > 0 ? Math.min(...trades.map(t => t.pnl)) : null

  const grossProfit = wins.reduce((s, t) => s + t.pnl, 0)
  const grossLoss = Math.abs(losses.reduce((s, t) => s + t.pnl, 0))
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : null

  // Trades by symbol
  const symbolMap = new Map<string, { trades: number, pnl: number }>()
  for (const t of trades) {
    const entry = symbolMap.get(t.symbol) ?? { trades: 0, pnl: 0 }
    entry.trades++
    entry.pnl += t.pnl
    symbolMap.set(t.symbol, entry)
  }
  const tradesBySymbol = [...symbolMap.entries()]
    .map(([symbol, v]) => ({ symbol, ...v }))
    .sort((a, b) => Math.abs(b.pnl) - Math.abs(a.pnl))
    .slice(0, 10)

  // Equity curve: daily cumulative PnL from rows sorted by date
  // We approximate by summing sell-side PnL per date bucket
  const dailyPnl = new Map<string, number>()
  for (const row of rows) {
    if (row.side === 'sell') {
      const dateKey = row.executedAt.toISOString().slice(0, 10)
      dailyPnl.set(dateKey, (dailyPnl.get(dateKey) ?? 0) + row.qty * row.price - Number.parseFloat(row.fees))
    }
  }

  let cumulative = 0
  const equityCurve = [...dailyPnl.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, pnl]) => {
      cumulative += pnl
      return { date, cumulativePnl: Math.round(cumulative * 100) / 100 }
    })

  return {
    totalTrades: trades.length,
    winRate,
    totalPnl: Math.round(totalPnl * 100) / 100,
    totalFees: Math.round(totalFees * 100) / 100,
    avgWin: avgWin !== null ? Math.round(avgWin * 100) / 100 : null,
    avgLoss: avgLoss !== null ? Math.round(avgLoss * 100) / 100 : null,
    bestTrade: bestTrade !== null ? Math.round(bestTrade * 100) / 100 : null,
    worstTrade: worstTrade !== null ? Math.round(worstTrade * 100) / 100 : null,
    profitFactor: profitFactor !== null ? Math.round(profitFactor * 1000) / 1000 : null,
    tradesBySymbol,
    equityCurve,
  }
}

export async function getCalendarPnl(userId: string, accountId?: string): Promise<CalendarPnlData> {
  const db = useDb()

  const conditions = [eq(executions.userId, userId)]
  if (accountId) conditions.push(eq(executions.accountId, accountId))

  const rows = await db
    .select()
    .from(executions)
    .where(and(...conditions))
    .orderBy(asc(executions.executedAt))

  const execData = rows.map(r => ({
    id: r.id,
    rawSymbol: r.rawSymbol,
    side: r.side,
    qty: r.qty,
    price: r.price,
    fees: Number.parseFloat(r.fees),
    executedAt: r.executedAt,
  }))

  const trades = computeFifoPnlWithDates(execData)

  // Group trades by date
  const dailyMap = new Map<string, { pnl: number, trades: number }>()
  for (const t of trades) {
    const dateKey = t.exitedAt.toISOString().slice(0, 10)
    const entry = dailyMap.get(dateKey) ?? { pnl: 0, trades: 0 }
    entry.pnl += t.pnl
    entry.trades++
    dailyMap.set(dateKey, entry)
  }

  // Group days by year-month
  const monthMap = new Map<string, { year: number, month: number, days: Map<string, { pnl: number, trades: number }> }>()
  for (const [dateKey, data] of dailyMap) {
    const [yearStr, monthStr] = dateKey.split('-')
    const year = Number.parseInt(yearStr!, 10)
    const month = Number.parseInt(monthStr!, 10)
    const monthKey = `${year}-${String(month).padStart(2, '0')}`
    if (!monthMap.has(monthKey)) {
      monthMap.set(monthKey, { year, month, days: new Map() })
    }
    monthMap.get(monthKey)!.days.set(dateKey, data)
  }

  const months = [...monthMap.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([, m]) => {
      const days = [...m.days.entries()]
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([date, d]) => ({
          date,
          pnl: Math.round(d.pnl * 100) / 100,
          trades: d.trades,
        }))
      return {
        year: m.year,
        month: m.month,
        totalPnl: Math.round(days.reduce((s, d) => s + d.pnl, 0) * 100) / 100,
        days,
      }
    })

  return { months }
}

export async function getAttribution(userId: string, accountId?: string): Promise<AttributionData> {
  const db = useDb()

  const conditions = [eq(executions.userId, userId)]
  if (accountId) conditions.push(eq(executions.accountId, accountId))

  const rows = await db
    .select()
    .from(executions)
    .where(and(...conditions))
    .orderBy(asc(executions.executedAt))

  const execData = rows.map(r => ({
    id: r.id,
    rawSymbol: r.rawSymbol,
    side: r.side,
    qty: r.qty,
    price: r.price,
    fees: Number.parseFloat(r.fees),
    executedAt: r.executedAt,
  }))

  const trades = computeFifoPnlWithDates(execData)

  // Build execution -> setupTag map from journal entries
  const tagRows = await db
    .select({
      executionId: sql<string>`unnest(${journalEntries.executionIds})`,
      setupTag: journalEntries.setupTag,
    })
    .from(journalEntries)
    .where(and(
      eq(journalEntries.userId, userId),
      isNotNull(journalEntries.setupTag),
    ))

  const execToTag = new Map<string, string>()
  for (const row of tagRows) {
    if (row.setupTag) execToTag.set(row.executionId, row.setupTag)
  }

  const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

  const bySymbol = computeAttributionRows(trades, t => t.symbol)
  const bySetupTag = computeAttributionRows(
    trades.filter(t => execToTag.has(t.executionId)),
    t => execToTag.get(t.executionId) ?? 'Unknown',
  )
  const byWeekday = computeAttributionRows(trades, t => WEEKDAYS[t.exitedAt.getUTCDay()]!)
  const bySession = computeAttributionRows(trades, t => sessionLabel(t.exitedAt))

  return { bySymbol, bySetupTag, byWeekday, bySession }
}

