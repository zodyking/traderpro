import { z } from 'zod'

export const journalPlannedSchema = z.object({
  entry: z.number().optional(),
  stop: z.number().optional(),
  target: z.number().optional(),
  size: z.number().optional(),
  thesis: z.string().optional(),
})

export const journalActualSchema = z.object({
  entry: z.number().optional(),
  exit: z.number().optional(),
  size: z.number().optional(),
})

export const journalCreateSchema = z.object({
  symbolId: z.string().uuid().optional(),
  strategyVersionId: z.string().uuid().optional(),
  side: z.enum(['long', 'short']).optional(),
  setupTag: z.string().max(64).optional(),
  planned: journalPlannedSchema.optional(),
  actual: journalActualSchema.optional(),
  emotion: z.string().max(128).optional(),
  mistakes: z.array(z.string().max(256)).optional(),
  note: z.string().max(8000).optional(),
  screenshots: z.array(z.string().url().or(z.string().startsWith('/'))).optional(),
  openedAt: z.string().datetime().optional(),
  closedAt: z.string().datetime().optional(),
})

export const journalUpdateSchema = journalCreateSchema.partial()

export const journalIdParamSchema = z.object({
  id: z.string().uuid(),
})

export const journalListQuerySchema = z.object({
  symbolId: z.string().uuid().optional(),
  setupTag: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  cursor: z.string().optional(),
})

export type JournalCreateInput = z.infer<typeof journalCreateSchema>
export type JournalUpdateInput = z.infer<typeof journalUpdateSchema>
export type JournalListQuery = z.infer<typeof journalListQuerySchema>
