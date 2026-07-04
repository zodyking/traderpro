import { z } from 'zod'

export const apiKeyCreateSchema = z.object({
  name: z.string().min(1).max(80),
  scopes: z.array(z.string().max(64)).max(20).optional(),
})

export const apiKeyIdParamSchema = z.object({
  id: z.string().uuid(),
})

export type ApiKeyCreateInput = z.infer<typeof apiKeyCreateSchema>

export type ApiKeyRow = {
  id: string
  name: string
  scopes: string[]
  lastUsedAt: string | null
  revokedAt: string | null
  createdAt: string
}

export type ApiKeyCreated = ApiKeyRow & {
  key: string
}
