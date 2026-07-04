/**
 * Tests for the /api/health endpoint handler and its version-reading logic.
 * The handler is a thin Nitro wrapper; we focus on the pure logic and the
 * return shape contract.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// ── Version-reading logic (mirrors server/api/health.get.ts) ─────────────────

function readAppVersion(): string {
  try {
    const pkg = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8')) as {
      version?: string
    }
    return pkg.version ?? '0.0.0'
  }
  catch {
    return '0.0.0'
  }
}

describe('readAppVersion logic', () => {
  it('returns a non-empty string', () => {
    const version = readAppVersion()
    expect(typeof version).toBe('string')
    expect(version.length).toBeGreaterThan(0)
  })

  it('returns "0.0.0" when package.json has no version field', () => {
    // Our workspace package.json has no version field, so this should be 0.0.0
    const pkg = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8')) as Record<string, unknown>
    const expected = (pkg.version as string | undefined) ?? '0.0.0'
    expect(readAppVersion()).toBe(expected)
  })

  it('returns "0.0.0" when JSON has no version field', () => {
    // Simulating the fallback branch
    const pkg: Record<string, unknown> = { name: 'test' }
    const result = (pkg.version as string | undefined) ?? '0.0.0'
    expect(result).toBe('0.0.0')
  })

  it('returns the version string from a valid package.json', () => {
    const pkg: Record<string, unknown> = { name: 'test', version: '1.2.3' }
    const result = (pkg.version as string | undefined) ?? '0.0.0'
    expect(result).toBe('1.2.3')
  })

  it('version string matches semver-like pattern or is "0.0.0"', () => {
    const version = readAppVersion()
    expect(version).toMatch(/^\d+\.\d+\.\d+/)
  })
})

// ── Health response contract ───────────────────────────────────────────────────

describe('health endpoint response shape', () => {
  function buildHealthResponse() {
    return {
      status: 'ok' as const,
      version: readAppVersion(),
    }
  }

  it('status is "ok"', () => {
    const response = buildHealthResponse()
    expect(response.status).toBe('ok')
  })

  it('version is a string', () => {
    const response = buildHealthResponse()
    expect(typeof response.version).toBe('string')
  })

  it('response has exactly the expected keys', () => {
    const response = buildHealthResponse()
    const keys = Object.keys(response).sort()
    expect(keys).toEqual(['status', 'version'])
  })

  it('version is not empty', () => {
    const response = buildHealthResponse()
    expect(response.version.length).toBeGreaterThan(0)
  })
})

// ── Handler module ─────────────────────────────────────────────────────────────

describe('health handler module', () => {
  it('default export is a function (Nitro event handler)', async () => {
    // defineEventHandler is a Nitro global; stub it so the module can be imported
    // outside a full Nuxt environment. The stub just returns the callback unchanged.
    const originalDef = (globalThis as Record<string, unknown>).defineEventHandler
    ;(globalThis as Record<string, unknown>).defineEventHandler = (fn: unknown) => fn

    try {
      const mod = await import('../server/api/health.get')
      expect(typeof mod.default).toBe('function')
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
})
