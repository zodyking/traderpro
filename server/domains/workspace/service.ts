import { and, asc, eq } from 'drizzle-orm'
import { v7 as uuidv7 } from 'uuid'
import { watchlistSymbols, watchlists, workspaces } from '../../../db/schema'
import type { WorkspaceLayout } from '../../../shared/schemas/workspace'
import { useDb } from '../../utils/db'

export async function listWorkspaces(userId: string) {
  const db = useDb()
  return db
    .select()
    .from(workspaces)
    .where(eq(workspaces.userId, userId))
    .orderBy(asc(workspaces.name))
}

export async function createWorkspace(
  userId: string,
  input: { name: string, layout?: WorkspaceLayout, isDefault?: boolean },
) {
  const db = useDb()
  const id = uuidv7()

  if (input.isDefault) {
    await db
      .update(workspaces)
      .set({ isDefault: false })
      .where(eq(workspaces.userId, userId))
  }

  const [workspace] = await db
    .insert(workspaces)
    .values({
      id,
      userId,
      name: input.name,
      layout: input.layout ?? {},
      isDefault: input.isDefault ?? false,
    })
    .returning()

  return workspace!
}

export async function updateWorkspace(
  userId: string,
  workspaceId: string,
  input: { name?: string, layout?: WorkspaceLayout, isDefault?: boolean },
) {
  const db = useDb()
  const [existing] = await db
    .select()
    .from(workspaces)
    .where(and(eq(workspaces.id, workspaceId), eq(workspaces.userId, userId)))
    .limit(1)

  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'Workspace not found' })
  }

  if (input.isDefault) {
    await db
      .update(workspaces)
      .set({ isDefault: false })
      .where(eq(workspaces.userId, userId))
  }

  const [workspace] = await db
    .update(workspaces)
    .set({
      name: input.name ?? existing.name,
      layout: input.layout ?? existing.layout,
      isDefault: input.isDefault ?? existing.isDefault,
      updatedAt: new Date(),
    })
    .where(eq(workspaces.id, workspaceId))
    .returning()

  return workspace!
}

export async function deleteWorkspace(userId: string, workspaceId: string) {
  const db = useDb()
  const result = await db
    .delete(workspaces)
    .where(and(eq(workspaces.id, workspaceId), eq(workspaces.userId, userId)))
    .returning({ id: workspaces.id })

  if (!result.length) {
    throw createError({ statusCode: 404, statusMessage: 'Workspace not found' })
  }
}

export async function listWatchlists(userId: string) {
  const db = useDb()
  const lists = await db
    .select()
    .from(watchlists)
    .where(eq(watchlists.userId, userId))
    .orderBy(asc(watchlists.sort), asc(watchlists.name))

  const result = []
  for (const list of lists) {
    const symbols = await db
      .select({
        symbolId: watchlistSymbols.symbolId,
        sort: watchlistSymbols.sort,
      })
      .from(watchlistSymbols)
      .where(eq(watchlistSymbols.watchlistId, list.id))
      .orderBy(asc(watchlistSymbols.sort))

    result.push({ ...list, symbols })
  }

  return result
}

export async function createWatchlist(
  userId: string,
  input: { name: string, sort?: number },
) {
  const db = useDb()
  const [watchlist] = await db
    .insert(watchlists)
    .values({
      id: uuidv7(),
      userId,
      name: input.name,
      sort: input.sort ?? 0,
    })
    .returning()

  return { ...watchlist!, symbols: [] }
}

export async function updateWatchlist(
  userId: string,
  watchlistId: string,
  input: { name?: string, sort?: number },
) {
  const db = useDb()
  const [existing] = await db
    .select()
    .from(watchlists)
    .where(and(eq(watchlists.id, watchlistId), eq(watchlists.userId, userId)))
    .limit(1)

  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'Watchlist not found' })
  }

  const [watchlist] = await db
    .update(watchlists)
    .set({
      name: input.name ?? existing.name,
      sort: input.sort ?? existing.sort,
    })
    .where(eq(watchlists.id, watchlistId))
    .returning()

  return watchlist!
}

export async function deleteWatchlist(userId: string, watchlistId: string) {
  const db = useDb()
  const result = await db
    .delete(watchlists)
    .where(and(eq(watchlists.id, watchlistId), eq(watchlists.userId, userId)))
    .returning({ id: watchlists.id })

  if (!result.length) {
    throw createError({ statusCode: 404, statusMessage: 'Watchlist not found' })
  }
}

export async function setWatchlistSymbols(
  userId: string,
  watchlistId: string,
  symbolIds: string[],
) {
  const db = useDb()
  const [existing] = await db
    .select()
    .from(watchlists)
    .where(and(eq(watchlists.id, watchlistId), eq(watchlists.userId, userId)))
    .limit(1)

  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'Watchlist not found' })
  }

  await db.delete(watchlistSymbols).where(eq(watchlistSymbols.watchlistId, watchlistId))

  if (symbolIds.length) {
    await db.insert(watchlistSymbols).values(
      symbolIds.map((symbolId, index) => ({
        watchlistId,
        symbolId,
        sort: index,
      })),
    )
  }

  return listWatchlists(userId)
}
