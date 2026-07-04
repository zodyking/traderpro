import type { EmailNotificationKey, EmailNotificationPreferences } from '../../../shared/types/email'
import { DEFAULT_EMAIL_NOTIFICATION_PREFERENCES } from '../../../shared/types/email'

export function normalizeEmailPreferences(
  value: unknown,
): EmailNotificationPreferences {
  const base = { ...DEFAULT_EMAIL_NOTIFICATION_PREFERENCES }

  if (!value || typeof value !== 'object') {
    return base
  }

  for (const key of Object.keys(base) as EmailNotificationKey[]) {
    const candidate = (value as Record<string, unknown>)[key]
    if (typeof candidate === 'boolean') {
      base[key] = candidate
    }
  }

  return base
}
