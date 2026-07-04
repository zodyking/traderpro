import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import { emailNotificationPreferencesSchema } from '../shared/schemas/email'
import { normalizeEmailPreferences } from '../server/domains/email/preferences'
import {
  deriveDefaultFromEmail,
  resolveFromAddress,
  resolveFromEmail,
} from '../server/domains/email/config'
import { renderWelcomeEmail } from '../server/domains/email/templates'

const envBackup = { ...process.env }

beforeEach(() => {
  process.env = { ...envBackup }
})

afterEach(() => {
  process.env = { ...envBackup }
})

describe('resolveFromAddress', () => {
  it('uses SMTP_FROM_EMAIL and SMTP_FROM_NAME', () => {
    process.env.SMTP_FROM_EMAIL = 'noreply@example.com'
    process.env.SMTP_FROM_NAME = 'AxiomEdge'

    expect(resolveFromAddress()).toBe('AxiomEdge <noreply@example.com>')
    expect(resolveFromEmail()).toBe('noreply@example.com')
  })

  it('derives from email from NUXT_PUBLIC_APP_URL when SMTP_FROM_EMAIL is unset', () => {
    delete process.env.SMTP_FROM_EMAIL
    delete process.env.SMTP_FROM
    process.env.NUXT_PUBLIC_APP_URL = 'https://app.example.com'

    expect(deriveDefaultFromEmail()).toBe('noreply@app.example.com')
    expect(resolveFromEmail()).toBe('noreply@app.example.com')
  })

  it('supports quoted SMTP_FROM override', () => {
    process.env.SMTP_FROM = 'AxiomEdge <alerts@axiomedge.app>'

    expect(resolveFromAddress()).toBe('AxiomEdge <alerts@axiomedge.app>')
  })
})

describe('emailNotificationPreferencesSchema', () => {
  it('accepts partial preference updates', () => {
    const parsed = emailNotificationPreferencesSchema.parse({
      login: false,
      alerts: true,
    })

    expect(parsed).toEqual({ login: false, alerts: true })
  })

  it('rejects unknown keys', () => {
    expect(() => emailNotificationPreferencesSchema.parse({ unknown: true })).toThrow()
  })
})

describe('normalizeEmailPreferences', () => {
  it('fills defaults for missing keys', () => {
    expect(normalizeEmailPreferences({ login: false })).toMatchObject({
      login: false,
      signUp: true,
      alerts: true,
    })
  })
})

describe('renderWelcomeEmail', () => {
  it('renders branded html with cta', () => {
    const html = renderWelcomeEmail({
      displayName: 'Alex',
      appUrl: 'https://axiomedge.app',
    })

    expect(html).toContain('AxiomEdge')
    expect(html).toContain('Welcome, Alex')
    expect(html).toContain('https://axiomedge.app/app')
    expect(html).toContain('#14E0B8')
  })
})
