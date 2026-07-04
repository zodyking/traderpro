export const EMAIL_NOTIFICATION_KEYS = [
  'signUp',
  'login',
  'alerts',
  'backtests',
  'productUpdates',
] as const

export type EmailNotificationKey = (typeof EMAIL_NOTIFICATION_KEYS)[number]

export type EmailNotificationPreferences = Record<EmailNotificationKey, boolean>

export const DEFAULT_EMAIL_NOTIFICATION_PREFERENCES: EmailNotificationPreferences = {
  signUp: true,
  login: true,
  alerts: true,
  backtests: true,
  productUpdates: false,
}
