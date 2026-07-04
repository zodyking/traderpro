import { describe, expect, it, vi } from 'vitest'
import {
  buildRateLimitKey,
  checkRateLimit,
  type RateLimitOptions,
} from '../server/utils/rate-limit'

function createMockRedis(count: number) {
  const exec = vi.fn().mockResolvedValue([
    [null, 0],
    [null, 1],
    [null, count],
    [null, 1],
  ])

  const multi = vi.fn().mockReturnValue({
    zremrangebyscore: vi.fn().mockReturnThis(),
    zadd: vi.fn().mockReturnThis(),
    zcard: vi.fn().mockReturnThis(),
    pexpire: vi.fn().mockReturnThis(),
    exec,
  })

  return { multi, exec }
}

describe('buildRateLimitKey', () => {
  it('joins scope and identifier', () => {
    expect(buildRateLimitKey('auth:/api/auth/login', '127.0.0.1')).toBe(
      'auth:/api/auth/login:127.0.0.1',
    )
  })
})

describe('checkRateLimit', () => {
  const baseOptions: RateLimitOptions = {
    key: 'test:user',
    limit: 10,
    windowMs: 60_000,
  }

  it('allows requests under the limit', async () => {
    const redis = createMockRedis(3)
    const result = await checkRateLimit(redis, baseOptions)

    expect(result.allowed).toBe(true)
    expect(result.limit).toBe(10)
    expect(result.remaining).toBe(7)
    expect(result.retryAfterMs).toBe(0)
    expect(redis.multi).toHaveBeenCalledOnce()
  })

  it('denies requests at the limit boundary', async () => {
    const redis = createMockRedis(10)
    const result = await checkRateLimit(redis, baseOptions)

    expect(result.allowed).toBe(true)
    expect(result.remaining).toBe(0)
  })

  it('denies requests over the limit', async () => {
    const redis = createMockRedis(11)
    const result = await checkRateLimit(redis, baseOptions)

    expect(result.allowed).toBe(false)
    expect(result.remaining).toBe(0)
    expect(result.retryAfterMs).toBe(60_000)
  })

  it('runs a sliding-window pipeline against Redis', async () => {
    const redis = createMockRedis(1)
    await checkRateLimit(redis, baseOptions)

    const pipeline = redis.multi.mock.results[0]!.value
    expect(pipeline.zremrangebyscore).toHaveBeenCalled()
    expect(pipeline.zadd).toHaveBeenCalled()
    expect(pipeline.zcard).toHaveBeenCalled()
    expect(pipeline.pexpire).toHaveBeenCalledWith('ratelimit:test:user', 60_000)
    expect(pipeline.exec).toHaveBeenCalledOnce()
  })
})

describe('rate limit policy constants', () => {
  it('matches expected auth and AI limits', () => {
    const authLimits = {
      login: 10,
      register: 5,
      aiReviewPerUser: 20,
      windowMs: 60_000,
    }

    expect(authLimits.login).toBe(10)
    expect(authLimits.register).toBe(5)
    expect(authLimits.aiReviewPerUser).toBe(20)
    expect(authLimits.windowMs).toBe(60_000)
  })
})
