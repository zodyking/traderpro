import type Redis from 'ioredis'
import { useRedis } from './redis'

export interface RateLimitOptions {
  key: string
  limit: number
  windowMs: number
}

export interface RateLimitResult {
  allowed: boolean
  limit: number
  remaining: number
  retryAfterMs: number
}

export function buildRateLimitKey(scope: string, identifier: string) {
  return `${scope}:${identifier}`
}

/**
 * Sliding-window rate limiter backed by a Redis sorted set.
 */
export async function checkRateLimit(
  redis: Pick<Redis, 'multi'>,
  options: RateLimitOptions,
): Promise<RateLimitResult> {
  const { key, limit, windowMs } = options
  const now = Date.now()
  const windowStart = now - windowMs
  const redisKey = `ratelimit:${key}`
  const member = `${now}:${Math.random().toString(36).slice(2)}`

  const pipeline = redis.multi()
  pipeline.zremrangebyscore(redisKey, 0, windowStart)
  pipeline.zadd(redisKey, now, member)
  pipeline.zcard(redisKey)
  pipeline.pexpire(redisKey, windowMs)

  const results = await pipeline.exec()
  const count = Number(results?.[2]?.[1] ?? 0)
  const allowed = count <= limit

  return {
    allowed,
    limit,
    remaining: Math.max(0, limit - count),
    retryAfterMs: allowed ? 0 : windowMs,
  }
}

export async function enforceRateLimit(options: RateLimitOptions): Promise<RateLimitResult> {
  const redis = useRedis()
  return checkRateLimit(redis, options)
}
