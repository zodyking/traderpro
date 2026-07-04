import { z } from 'zod'

export const workspaceLayoutSchema = z.object({
  activeSymbolId: z.string().uuid().optional(),
  chartInterval: z.enum(['1m', '5m', '15m', '1h', '4h', '1d', '1w']).optional(),
  panels: z.record(z.string(), z.unknown()).optional(),
  watchlistRailOpen: z.boolean().optional(),
})

export const createWorkspaceSchema = z.object({
  name: z.string().min(1).max(120),
  layout: workspaceLayoutSchema.optional(),
  isDefault: z.boolean().optional(),
})

export const updateWorkspaceSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  layout: workspaceLayoutSchema.optional(),
  isDefault: z.boolean().optional(),
})

export const createWatchlistSchema = z.object({
  name: z.string().min(1).max(120),
  sort: z.number().int().optional(),
})

export const updateWatchlistSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  sort: z.number().int().optional(),
})

export const watchlistSymbolsSchema = z.object({
  symbolIds: z.array(z.string().uuid()),
})

export type WorkspaceLayout = z.infer<typeof workspaceLayoutSchema>
