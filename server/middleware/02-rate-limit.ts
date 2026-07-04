import type { H3Event } from 'h3'
import { getRequestIP, isError } from 'h3'
import { buildRateLimitKey, enforceRateLimit } from '../utils/rate-limit'
import { logError } from '../utils/logger'

const ONE_MINUTE_MS = 60_000

const AUTH_RATE_LIMITS: Record<string, { limit: number, windowMs: number }> = {
  '/api/auth/login': { limit: 10, windowMs: ONE_MINUTE_MS },
  '/api/auth/register': { limit: 5, windowMs: ONE_MINUTE_MS },
}

const AI_REVIEW_POST_PATHS = new Set([
  '/api/ai/review/trade',
  '/api/ai/review/risk',
  '/api/ai/review/strategy',
  '/api/ai/reviews',
])

function isAiReviewPost(path: string, method: string) {
  return method === 'POST' && AI_REVIEW_POST_PATHS.has(path)
}

function setRateLimitHeaders(event: H3Event, limit: number, remaining: number) {
  setResponseHeader(event, 'X-RateLimit-Limit', String(limit))
  setResponseHeader(event, 'X-RateLimit-Remaining', String(remaining))
}

async function applyRateLimit(
  event: H3Event,
  scope: string,
  identifier: string,
  limit: number,
  windowMs: number,
) {
  try {
    const result = await enforceRateLimit({
      key: buildRateLimitKey(scope, identifier),
      limit,
      windowMs,
    })

    setRateLimitHeaders(event, result.limit, result.remaining)

    if (!result.allowed) {
      setResponseHeader(event, 'Retry-After', Math.ceil(result.retryAfterMs / 1000))
      throw createError({
        statusCode: 429,
        statusMessage: 'Too many requests',
      })
    }
  }
  catch (error) {
    if (isError(error) && error.statusCode === 429) {
      throw error
    }

    logError('rate-limit', error, {
      scope,
      identifier,
      path: event.path,
    })
  }
}

export default defineEventHandler(async (event) => {
  const { path } = event
  const method = event.method.toUpperCase()

  if (method === 'POST' && path in AUTH_RATE_LIMITS) {
    const config = AUTH_RATE_LIMITS[path]!
    const ip = getRequestIP(event, { xForwardedFor: true }) ?? 'unknown'

    await applyRateLimit(
      event,
      `auth:${path}`,
      ip,
      config.limit,
      config.windowMs,
    )
    return
  }

  if (!isAiReviewPost(path, method)) {
    return
  }

  const session = await getUserSession(event)
  const userId = session.user?.id

  if (!userId) {
    return
  }

  await applyRateLimit(event, 'ai:review', userId, 20, ONE_MINUTE_MS)
})
