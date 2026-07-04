import { z } from 'zod'
import { EMAIL_NOTIFICATION_KEYS } from '../types/email'

const preferenceShape = Object.fromEntries(
  EMAIL_NOTIFICATION_KEYS.map((key) => [key, z.boolean().optional()]),
) as Record<(typeof EMAIL_NOTIFICATION_KEYS)[number], z.ZodOptional<z.ZodBoolean>>

export const emailNotificationPreferencesSchema = z.object(preferenceShape).strict()

export type EmailNotificationPreferencesInput = z.infer<typeof emailNotificationPreferencesSchema>
