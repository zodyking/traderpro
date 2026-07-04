import { and, asc, desc, eq, max } from 'drizzle-orm'
import { v7 as uuidv7 } from 'uuid'
import { strategies, strategyVersions } from '../../../db/schema'
import type {
  CreateStrategyInput,
  CreateStrategyVersionInput,
  UpdateStrategyInput,
} from '../../../shared/schemas/strategy'
import { useDb } from '../../utils/db'

export async function listStrategies(userId: string) {
  const db = useDb()
  const rows = await db
    .select()
    .from(strategies)
    .where(eq(strategies.userId, userId))
    .orderBy(asc(strategies.name))

  const result = []
  for (const strategy of rows) {
    const versions = await db
      .select()
      .from(strategyVersions)
      .where(eq(strategyVersions.strategyId, strategy.id))
      .orderBy(desc(strategyVersions.version))

    result.push({ ...strategy, versions })
  }

  return result
}

export async function getStrategy(userId: string, strategyId: string) {
  const db = useDb()
  const [strategy] = await db
    .select()
    .from(strategies)
    .where(and(eq(strategies.id, strategyId), eq(strategies.userId, userId)))
    .limit(1)

  if (!strategy) {
    throw createError({ statusCode: 404, statusMessage: 'Strategy not found' })
  }

  const versions = await db
    .select()
    .from(strategyVersions)
    .where(eq(strategyVersions.strategyId, strategyId))
    .orderBy(desc(strategyVersions.version))

  return { ...strategy, versions }
}

export async function createStrategy(userId: string, input: CreateStrategyInput) {
  const db = useDb()
  const [strategy] = await db
    .insert(strategies)
    .values({
      id: uuidv7(),
      userId,
      name: input.name,
      assetClass: input.assetClass,
      timeframe: input.timeframe,
    })
    .returning()

  return strategy!
}

export async function updateStrategy(
  userId: string,
  strategyId: string,
  input: UpdateStrategyInput,
) {
  const db = useDb()
  const [existing] = await db
    .select()
    .from(strategies)
    .where(and(eq(strategies.id, strategyId), eq(strategies.userId, userId)))
    .limit(1)

  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'Strategy not found' })
  }

  const [strategy] = await db
    .update(strategies)
    .set({
      name: input.name ?? existing.name,
      archivedAt: input.archivedAt === undefined ? existing.archivedAt : input.archivedAt,
    })
    .where(eq(strategies.id, strategyId))
    .returning()

  return strategy!
}

export async function createStrategyVersion(
  userId: string,
  strategyId: string,
  input: CreateStrategyVersionInput,
) {
  const db = useDb()
  const [strategy] = await db
    .select()
    .from(strategies)
    .where(and(eq(strategies.id, strategyId), eq(strategies.userId, userId)))
    .limit(1)

  if (!strategy) {
    throw createError({ statusCode: 404, statusMessage: 'Strategy not found' })
  }

  const [latest] = await db
    .select({ maxVersion: max(strategyVersions.version) })
    .from(strategyVersions)
    .where(eq(strategyVersions.strategyId, strategyId))

  const nextVersion = (latest?.maxVersion ?? 0) + 1

  const [version] = await db
    .insert(strategyVersions)
    .values({
      id: uuidv7(),
      strategyId,
      version: nextVersion,
      rules: input.rules,
      riskModel: input.riskModel,
      filters: input.filters ?? {},
      assumptions: input.assumptions ?? {},
      note: input.note ?? null,
    })
    .returning()

  return version!
}

export async function getStrategyVersion(userId: string, versionId: string) {
  const db = useDb()
  const [version] = await db
    .select()
    .from(strategyVersions)
    .where(eq(strategyVersions.id, versionId))
    .limit(1)

  if (!version) {
    throw createError({ statusCode: 404, statusMessage: 'Strategy version not found' })
  }

  const [strategy] = await db
    .select()
    .from(strategies)
    .where(and(eq(strategies.id, version.strategyId), eq(strategies.userId, userId)))
    .limit(1)

  if (!strategy) {
    throw createError({ statusCode: 404, statusMessage: 'Strategy version not found' })
  }

  return { ...version, strategy }
}
