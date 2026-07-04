import type { H3Event } from 'h3'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getApiKeyUser, setApiKeyUser } from '../server/utils/api-key-context'

const mockUseDb = vi.fn()

vi.mock('../server/utils/db', () => ({
  useDb: () => mockUseDb(),
}))

function createEvent(headers: Record<string, string> = {}): H3Event {
  return {
    context: {},
    node: {
      req: {
        headers,
      },
    },
  } as unknown as H3Event
}

describe('api-key context', () => {
  it('stores and retrieves API key auth context on the event', () => {
    const event = createEvent()

    expect(getApiKeyUser(event)).toBeNull()

    setApiKeyUser(event, {
      userId: 'user-1',
      apiKeyId: 'key-1',
    })

    expect(getApiKeyUser(event)).toEqual({
      userId: 'user-1',
      apiKeyId: 'key-1',
    })
  })
})

describe('requireUserOrApiKey', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    mockUseDb.mockReset()
  })

  it('returns the session user when present', async () => {
    const sessionUser = {
      id: 'user-session',
      email: 'user@example.com',
      displayName: 'Session User',
      experience: 'novice' as const,
      uiMode: 'novice' as const,
    }

    vi.stubGlobal('getUserSession', vi.fn().mockResolvedValue({ user: sessionUser }))

    const { requireUserOrApiKey } = await import('../server/utils/auth')
    const event = createEvent()

    await expect(requireUserOrApiKey(event)).resolves.toEqual(sessionUser)

    vi.unstubAllGlobals()
  })

  it('falls back to the API key user when no session exists', async () => {
    const sessionUser = {
      id: 'user-api',
      email: 'api@example.com',
      displayName: 'API User',
      experience: 'advanced' as const,
      uiMode: 'pro' as const,
    }

    vi.stubGlobal('getUserSession', vi.fn().mockResolvedValue({ user: null }))
    mockUseDb.mockReturnValue({
      select: () => ({
        from: () => ({
          where: () => ({
            limit: async () => [{
              id: sessionUser.id,
              email: sessionUser.email,
              displayName: sessionUser.displayName,
              experience: sessionUser.experience,
              uiMode: sessionUser.uiMode,
              deletedAt: null,
            }],
          }),
        }),
      }),
    })

    const { requireUserOrApiKey } = await import('../server/utils/auth')
    const event = createEvent()

    setApiKeyUser(event, {
      userId: 'user-api',
      apiKeyId: 'key-api',
    })

    await expect(requireUserOrApiKey(event)).resolves.toEqual(sessionUser)

    vi.unstubAllGlobals()
  })

  it('throws 401 when neither session nor API key auth is present', async () => {
    vi.stubGlobal('getUserSession', vi.fn().mockResolvedValue({ user: null }))
    vi.stubGlobal('createError', (input: { statusCode: number, statusMessage: string }) => {
      const error = new Error(input.statusMessage) as Error & {
        statusCode: number
        statusMessage: string
      }
      error.statusCode = input.statusCode
      error.statusMessage = input.statusMessage
      return error
    })

    const { requireUserOrApiKey } = await import('../server/utils/auth')
    const event = createEvent()

    await expect(requireUserOrApiKey(event)).rejects.toMatchObject({
      statusCode: 401,
      statusMessage: 'Unauthorized',
    })

    vi.unstubAllGlobals()
  })
})

describe('api key middleware', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('ignores requests without a Bearer token', async () => {
    const originalDef = (globalThis as Record<string, unknown>).defineEventHandler
    ;(globalThis as Record<string, unknown>).defineEventHandler = (fn: unknown) => fn

    try {
      const mod = await import('../server/middleware/03-api-key-auth')
      const event = createEvent()

      await expect(mod.default(event)).resolves.toBeUndefined()
      expect(getApiKeyUser(event)).toBeNull()
    }
    finally {
      if (originalDef === undefined) {
        delete (globalThis as Record<string, unknown>).defineEventHandler
      }
      else {
        ;(globalThis as Record<string, unknown>).defineEventHandler = originalDef
      }
    }
  })

  it('ignores non-ae bearer tokens', async () => {
    const authenticateApiKey = vi.fn()
    vi.doMock('../server/domains/identity/api-keys', () => ({
      authenticateApiKey,
    }))

    const originalDef = (globalThis as Record<string, unknown>).defineEventHandler
    ;(globalThis as Record<string, unknown>).defineEventHandler = (fn: unknown) => fn

    try {
      vi.resetModules()
      const mod = await import('../server/middleware/03-api-key-auth')
      const event = createEvent({
        authorization: 'Bearer session-token',
      })

      await expect(mod.default(event)).resolves.toBeUndefined()
      expect(authenticateApiKey).not.toHaveBeenCalled()
      expect(getApiKeyUser(event)).toBeNull()
    }
    finally {
      vi.doUnmock('../server/domains/identity/api-keys')
      vi.resetModules()

      if (originalDef === undefined) {
        delete (globalThis as Record<string, unknown>).defineEventHandler
      }
      else {
        ;(globalThis as Record<string, unknown>).defineEventHandler = originalDef
      }
    }
  })

  it('rejects invalid ae_ bearer tokens', async () => {
    const originalDef = (globalThis as Record<string, unknown>).defineEventHandler
    ;(globalThis as Record<string, unknown>).defineEventHandler = (fn: unknown) => fn

    vi.doMock('../server/domains/identity/api-keys', () => ({
      authenticateApiKey: vi.fn().mockResolvedValue(null),
    }))

    vi.stubGlobal('createError', (input: { statusCode: number, statusMessage: string }) => {
      const error = new Error(input.statusMessage) as Error & {
        statusCode: number
        statusMessage: string
      }
      error.statusCode = input.statusCode
      error.statusMessage = input.statusMessage
      return error
    })

    try {
      vi.resetModules()
      const mod = await import('../server/middleware/03-api-key-auth')
      const event = createEvent({
        authorization: 'Bearer ae_invalid',
      })

      await expect(mod.default(event)).rejects.toMatchObject({
        statusCode: 401,
        statusMessage: 'Invalid API key',
      })
    }
    finally {
      vi.doUnmock('../server/domains/identity/api-keys')
      vi.unstubAllGlobals()
      vi.resetModules()

      if (originalDef === undefined) {
        delete (globalThis as Record<string, unknown>).defineEventHandler
      }
      else {
        ;(globalThis as Record<string, unknown>).defineEventHandler = originalDef
      }
    }
  })

  it('attaches API key context for valid bearer tokens', async () => {
    const originalDef = (globalThis as Record<string, unknown>).defineEventHandler
    ;(globalThis as Record<string, unknown>).defineEventHandler = (fn: unknown) => fn

    vi.doMock('../server/domains/identity/api-keys', () => ({
      authenticateApiKey: vi.fn().mockResolvedValue({
        userId: 'user-123',
        apiKeyId: 'key-123',
      }),
    }))

    try {
      vi.resetModules()
      const mod = await import('../server/middleware/03-api-key-auth')
      const event = createEvent({
        authorization: 'Bearer ae_valid-token',
      })

      await mod.default(event)

      expect(getApiKeyUser(event)).toEqual({
        userId: 'user-123',
        apiKeyId: 'key-123',
      })
    }
    finally {
      vi.doUnmock('../server/domains/identity/api-keys')
      vi.resetModules()

      if (originalDef === undefined) {
        delete (globalThis as Record<string, unknown>).defineEventHandler
      }
      else {
        ;(globalThis as Record<string, unknown>).defineEventHandler = originalDef
      }
    }
  })
})
