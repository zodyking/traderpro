import { and, desc, eq, inArray, lt } from 'drizzle-orm'
import { v7 as uuidv7 } from 'uuid'
import { aiReviews, executions, journalEntries, symbols } from '../../../db/schema'
import type { JournalCreateInput, JournalListQuery, JournalUpdateInput } from '../../../shared/schemas/journal'
import type { PlanVsExecutionExecution } from '../../../shared/schemas/broker'
import { requestReview } from '../ai/service'
import { useDb } from '../../utils/db'

async function assertEntryOwnership(userId: string, entryId: string) {
  const db = useDb()
  const [entry] = await db
    .select()
    .from(journalEntries)
    .where(and(eq(journalEntries.id, entryId), eq(journalEntries.userId, userId)))
    .limit(1)

  if (!entry) {
    throw createError({ statusCode: 404, statusMessage: 'Journal entry not found' })
  }

  return entry
}

async function loadLinkedExecutions(
  userId: string,
  executionIds: string[],
): Promise<PlanVsExecutionExecution[]> {
  if (executionIds.length === 0) return []

  const db = useDb()
  const rows = await db
    .select()
    .from(executions)
    .where(and(eq(executions.userId, userId), inArray(executions.id, executionIds)))

  const byId = new Map(rows.map(row => [row.id, row]))

  return executionIds
    .map(id => byId.get(id))
    .filter((row): row is NonNullable<typeof row> => row != null)
    .map(row => ({
      id: row.id,
      rawSymbol: row.rawSymbol,
      side: row.side as 'buy' | 'sell',
      qty: row.qty,
      price: row.price,
      executedAt: row.executedAt.toISOString(),
    }))
}

async function enrichEntry(
  userId: string,
  entry: typeof journalEntries.$inferSelect,
  symbolTicker?: string | null,
) {
  let ticker = symbolTicker
  if (ticker === undefined && entry.symbolId) {
    const db = useDb()
    const [row] = await db
      .select({ ticker: symbols.ticker })
      .from(symbols)
      .where(eq(symbols.id, entry.symbolId))
      .limit(1)
    ticker = row?.ticker ?? null
  }

  const linkedExecutions = await loadLinkedExecutions(userId, entry.executionIds)
  return {
    ...entry,
    symbolTicker: ticker ?? null,
    linkedExecutions,
  }
}

export async function listEntries(userId: string, query: JournalListQuery) {
  const db = useDb()
  const conditions = [eq(journalEntries.userId, userId)]

  if (query.symbolId) {
    conditions.push(eq(journalEntries.symbolId, query.symbolId))
  }

  if (query.setupTag) {
    conditions.push(eq(journalEntries.setupTag, query.setupTag))
  }

  if (query.cursor) {
    const decoded = Buffer.from(query.cursor, 'base64url').toString()
    const [ts] = decoded.split('|')
    if (ts) {
      conditions.push(lt(journalEntries.createdAt, new Date(ts)))
    }
  }

  const rows = await db
    .select({ entry: journalEntries, symbolTicker: symbols.ticker })
    .from(journalEntries)
    .leftJoin(symbols, eq(journalEntries.symbolId, symbols.id))
    .where(and(...conditions))
    .orderBy(desc(journalEntries.createdAt))
    .limit(query.limit + 1)

  const hasMore = rows.length > query.limit
  const slice = hasMore ? rows.slice(0, query.limit) : rows
  const last = slice.at(-1)
  const nextCursor = hasMore && last
    ? Buffer.from(`${last.entry.createdAt.toISOString()}|${last.entry.id}`).toString('base64url')
    : null

  const entries = await Promise.all(slice.map(async (r) => {
    return enrichEntry(userId, r.entry, r.symbolTicker ?? null)
  }))

  return { entries, nextCursor }
}

export async function getEntry(userId: string, entryId: string) {
  const db = useDb()
  const [row] = await db
    .select({ entry: journalEntries, symbolTicker: symbols.ticker })
    .from(journalEntries)
    .leftJoin(symbols, eq(journalEntries.symbolId, symbols.id))
    .where(and(eq(journalEntries.id, entryId), eq(journalEntries.userId, userId)))
    .limit(1)

  if (!row) {
    throw createError({ statusCode: 404, statusMessage: 'Journal entry not found' })
  }

  return enrichEntry(userId, row.entry, row.symbolTicker ?? null)
}

export async function createEntry(userId: string, input: JournalCreateInput) {
  const db = useDb()
  const id = uuidv7()

  const [entry] = await db
    .insert(journalEntries)
    .values({
      id,
      userId,
      symbolId: input.symbolId ?? null,
      strategyVersionId: input.strategyVersionId ?? null,
      executionIds: input.executionIds ?? [],
      side: input.side ?? null,
      setupTag: input.setupTag ?? null,
      planned: input.planned ?? {},
      actual: input.actual ?? {},
      emotion: input.emotion ?? null,
      mistakes: input.mistakes ?? [],
      note: input.note ?? null,
      screenshots: input.screenshots ?? [],
      openedAt: input.openedAt ? new Date(input.openedAt) : null,
      closedAt: input.closedAt ? new Date(input.closedAt) : null,
    })
    .returning()

  return enrichEntry(userId, entry!)
}

export async function updateEntry(userId: string, entryId: string, input: JournalUpdateInput) {
  await assertEntryOwnership(userId, entryId)
  const db = useDb()

  const patch: Record<string, unknown> = {}

  if (input.symbolId !== undefined) patch.symbolId = input.symbolId
  if (input.strategyVersionId !== undefined) patch.strategyVersionId = input.strategyVersionId
  if (input.executionIds !== undefined) patch.executionIds = input.executionIds
  if (input.side !== undefined) patch.side = input.side
  if (input.setupTag !== undefined) patch.setupTag = input.setupTag
  if (input.planned !== undefined) patch.planned = input.planned
  if (input.actual !== undefined) patch.actual = input.actual
  if (input.emotion !== undefined) patch.emotion = input.emotion
  if (input.mistakes !== undefined) patch.mistakes = input.mistakes
  if (input.note !== undefined) patch.note = input.note
  if (input.screenshots !== undefined) patch.screenshots = input.screenshots
  if (input.openedAt !== undefined) patch.openedAt = input.openedAt ? new Date(input.openedAt) : null
  if (input.closedAt !== undefined) patch.closedAt = input.closedAt ? new Date(input.closedAt) : null

  const [updated] = await db
    .update(journalEntries)
    .set(patch)
    .where(and(eq(journalEntries.id, entryId), eq(journalEntries.userId, userId)))
    .returning()

  return enrichEntry(userId, updated!)
}

export async function deleteEntry(userId: string, entryId: string) {
  await assertEntryOwnership(userId, entryId)
  const db = useDb()

  await db
    .delete(journalEntries)
    .where(and(eq(journalEntries.id, entryId), eq(journalEntries.userId, userId)))
}

export async function requestTradeReview(userId: string, entryId: string) {
  await assertEntryOwnership(userId, entryId)
  const result = await requestReview(userId, {
    targetType: 'trade',
    targetId: entryId,
    reviewType: 'trade',
  })

  const db = useDb()
  const [review] = await db
    .select()
    .from(aiReviews)
    .where(eq(aiReviews.id, result.id))
    .limit(1)

  return review!
}

export async function getTradeReviews(userId: string, entryId: string) {
  await assertEntryOwnership(userId, entryId)
  const db = useDb()

  const reviews = await db
    .select()
    .from(aiReviews)
    .where(and(
      eq(aiReviews.userId, userId),
      eq(aiReviews.targetType, 'trade'),
      eq(aiReviews.targetId, entryId),
    ))
    .orderBy(desc(aiReviews.createdAt))
    .limit(10)

  return reviews
}
