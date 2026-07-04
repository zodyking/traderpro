import postgres from 'postgres'

const poolHolder: { pool?: ReturnType<typeof postgres> } = {}

export function useDbPool() {
  if (!poolHolder.pool) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Database pool not initialized',
    })
  }
  return poolHolder.pool
}

export function initDbPool(databaseUrl: string) {
  if (!poolHolder.pool) {
    poolHolder.pool = postgres(databaseUrl, { max: 10 })
  }
  return poolHolder.pool
}

export default defineNitroPlugin((nitroApp) => {
  const config = useRuntimeConfig()
  const databaseUrl = config.databaseUrl || process.env.DATABASE_URL || ''

  if (!databaseUrl) {
    console.warn('[db] DATABASE_URL is not configured')
    return
  }

  poolHolder.pool = postgres(databaseUrl, { max: 10 })

  nitroApp.hooks.hook('close', async () => {
    await poolHolder.pool?.end({ timeout: 5 })
    poolHolder.pool = undefined
  })
})
