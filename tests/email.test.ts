import { describe, expect, it } from 'vitest'
import { emailNotificationPreferencesSchema } from '../shared/schemas/email'
import { normalizeEmailPreferences } from '../server/domains/email/preferences'
import { renderWelcomeEmail } from '../server/domains/email/templates'

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
