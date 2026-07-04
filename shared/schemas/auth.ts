import { z } from 'zod'

export const registerSchema = z.object({
  email: z.email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  displayName: z.string().min(1).max(120),
})

export const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
})

export const mfaVerifySchema = z.object({
  code: z.string().regex(/^\d{6}$/, 'Code must be 6 digits'),
})

export type RegisterInput = z.infer<typeof registerSchema>
export type LoginInput = z.infer<typeof loginSchema>
export type MfaVerifyInput = z.infer<typeof mfaVerifySchema>
